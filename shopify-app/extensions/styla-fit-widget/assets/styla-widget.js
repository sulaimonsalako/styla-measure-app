/* Styla Fit Advisor — storefront widget.
 * Talks to the real Styla engine at styla.ca (CORS-enabled):
 *   POST /api/widget-size      -> recommended size + every size's fit, from the brand's chart
 *   POST /api/extension-chat   -> page-aware AI tailor (streamed for speed)
 * Guests answer a few measurements once (kept in localStorage); logged-in Styla
 * users get their saved profile. No hardcoded sizing.
 */
(function () {
  var API = 'https://www.styla.ca';
  var STYLA_ORIGIN = 'https://www.styla.ca';
  var SB_URL = 'https://tneflxtpmzodauygtslk.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZWZseHRwbXpvZGF1eWd0c2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzA1NTMsImV4cCI6MjA5MzkwNjU1M30.DkzB5-novfMp1IaY4d9710YTv_U7DME3_EC8Jc87MLc';
  var LS_PROFILE = 'styla_widget_profile';
  var LS_TOKEN = 'styla_widget_token';
  var LS_REFRESH = 'styla_widget_refresh';
  var LS_EXP = 'styla_widget_token_exp';
  var LS_PEOPLE = 'styla_widget_people';   // people the shopper buys for, estimated locally

  function getPeople() { try { return JSON.parse(localStorage.getItem(LS_PEOPLE) || '[]'); } catch (e) { return []; } }
  function savePerson(person) {
    var list = getPeople().filter(function (p) { return p.id !== person.id; });
    list.push(person);
    try { localStorage.setItem(LS_PEOPLE, JSON.stringify(list)); } catch (e) {}
    return list;
  }


  // ---------------- i18n + units ----------------
  //
  // Fit sentences used to arrive from the server as finished English prose with
  // inch marks baked in ("Ideal fit (4.5\" ease · ideal ~3\")"). That made them
  // impossible to translate AND impossible to show in centimetres. The engine now
  // returns structured facts and we compose the sentence here, so language and
  // units are both a client concern.
  var STR = {
    en: {
      dim_chest:'Chest', dim_waist:'Waist', dim_hips:'Hips', dim_belly:'Stomach',
      dim_shoulder:'Shoulder', dim_sleeve:'Sleeve', dim_inseam:'Inseam',
      dim_thigh:'Thigh', dim_neck:'Neck', dim_length:'Length', dim_rise:'Rise',
      dim_leg_opening:'Leg opening',
      v_slim:'Snug', v_ideal:'Ideal', v_relaxed:'Relaxed', v_oversized:'Oversized',
      fit_ease:'{v} ease', fit_ideal:'ideal ~{v}', fit_tight:'{v} too tight',
      fit_info:'{v}',
    }
  };
  var LOCALE = 'en';
  function setLocale(v) { if (v) LOCALE = String(v).slice(0, 2).toLowerCase(); }
  // Shopify gives us request.locale on the block; fall back to <html lang>.
  setLocale((document.querySelector('.styla-widget-container') || {}).dataset &&
            document.querySelector('.styla-widget-container').dataset.locale ||
            document.documentElement.getAttribute('lang'));
  function t(key, vars) {
    var dict = STR[LOCALE] || STR.en;
    var out = (dict[key] !== undefined ? dict[key] : STR.en[key]);
    if (out === undefined) return key;
    if (vars) Object.keys(vars).forEach(function (k) { out = out.replace('{' + k + '}', vars[k]); });
    return out;
  }

  // The engine always reports inches. Everything else is presentation.
  var UNIT = 'in';
  function setUnit(u) { UNIT = (u === 'cm') ? 'cm' : 'in'; }
  function len(inches) {
    if (inches == null || isNaN(inches)) return '';
    if (UNIT === 'cm') return (Math.round(inches * 2.54 * 10) / 10) + ' cm';
    return (Math.round(inches * 10) / 10) + '"';
  }

  // Compose the fit sentence from a structured fact.
  function factText(f) {
    if (!f) return '';
    if (f.verdict === 'info') return t('fit_info', { v: len(f.value) });
    if (!f.ok) return t('fit_tight', { v: len(Math.abs(f.ease)) });
    var bits = [t('fit_ease', { v: len(f.ease) })];
    if (f.ideal != null) bits.push(t('fit_ideal', { v: len(f.ideal) }));
    return bits.join(' \u00b7 ');
  }
  function factLabel(f, key) { return t('dim_' + (f && f.dim ? f.dim : key)); }
  function factBadge(f) {
    if (!f) return '';
    if (f.verdict === 'info') return '';
    if (!f.ok) return t('v_slim');
    return t('v_' + f.verdict) || '';
  }

  function getProfile() { try { return JSON.parse(localStorage.getItem(LS_PROFILE) || 'null'); } catch (e) { return null; } }
  function setProfile(p) { try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch (e) {} }
  function getToken() { try { return localStorage.getItem(LS_TOKEN) || null; } catch (e) { return null; } }

  // Persist a Styla session (from the "Continue with Styla" popup or refresh).
  function setSession(s) {
    try {
      if (s.access_token) localStorage.setItem(LS_TOKEN, s.access_token);
      if (s.refresh_token) localStorage.setItem(LS_REFRESH, s.refresh_token);
      if (s.expires_at) localStorage.setItem(LS_EXP, String(s.expires_at));
      if (s.profile) setProfile(s.profile);
    } catch (e) {}
  }
  function clearSession() { try { [LS_TOKEN, LS_REFRESH, LS_EXP, LS_PROFILE].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }
  function isSignedIn() { return !!getToken(); }

  // Keep the shopper signed in across the ~1h token expiry: silently refresh via
  // Supabase using the stored refresh token. Returns a valid access token or null
  // (null => refresh failed / signed out).
  async function ensureFreshToken() {
    var t = getToken(); if (!t) return null;
    var exp = parseInt(localStorage.getItem(LS_EXP) || '0', 10);
    var rt = localStorage.getItem(LS_REFRESH);
    if (exp && rt && (Date.now() / 1000) > (exp - 120)) {
      try {
        var r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SB_ANON },
          body: JSON.stringify({ refresh_token: rt })
        });
        var d = await r.json();
        if (d.access_token) {
          setSession({ access_token: d.access_token, refresh_token: d.refresh_token,
            expires_at: d.expires_at || (Math.floor(Date.now() / 1000) + (d.expires_in || 3600)) });
          return d.access_token;
        }
        clearSession(); return null; // refresh rejected -> treat as signed out
      } catch (e) { return t; } // network blip -> use existing token
    }
    return t;
  }

  function statusFor(text) {
    var t = (text || '').toLowerCase();
    if (/too tight|too short|too narrow|tight \(/.test(t)) return 'err';
    if (/snug|slim|tight collar|cropped/.test(t)) return 'warn';
    if (/perfect|ideal/.test(t)) return 'ok';
    if (/relaxed|loose|long|oversized|puddle/.test(t)) return 'warn';
    return 'ok';
  }
  function badgeFor(text) {
    var t = (text || '').toLowerCase();
    if (/too tight|too short|too narrow/.test(t)) return 'Too tight';
    if (/snug|slim/.test(t)) return 'Snug';
    if (/perfect|ideal/.test(t)) return 'Ideal';
    if (/relaxed|loose|long/.test(t)) return 'Relaxed';
    if (/oversized|puddle/.test(t)) return 'Oversized';
    return 'Good';
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  // Chart columns, size names and fit notes are merchant-authored strings that we
  // now inject as HTML (tables, comparison rows) — escape everything.
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Explicit measurement vocabulary — shoppers and brands must know WHICH sleeve
  // and WHICH shoulder we're comparing. Canonical: sleeve = shoulder seam → wrist,
  // shoulder = full cross-back (seam to seam). Charts measured centre-back → wrist
  // or half-shoulder are converted to these before comparison.
  var DIM_LABELS = {
    sleeve: 'Sleeve (shoulder → wrist)',
    shoulder: 'Shoulder (cross-back)',
    chest: 'Chest', waist: 'Waist', hips: 'Hips', belly: 'Belly',
    inseam: 'Inseam', neck: 'Neck', thigh: 'Thigh', length: 'Length', height: 'Height',
  };
  function dimLabel(k) { return DIM_LABELS[k] || cap(k); }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.styla-widget-container').forEach(function (container) {
      var d = container.dataset;
      var blockId = container.id.replace('styla-widget-', '');
      var el = function (id) { return document.getElementById(id + '-' + blockId); };

      // Units: follow the storefront's country rather than defaulting everyone to
      // inches. Most of the world measures in cm, which matters more for a fit
      // product than the interface language does.
      (function () {
        var d = container.dataset;
        if (d.units === 'cm' || d.units === 'in') { setUnit(d.units); return; }
        var c = (d.country || '').toUpperCase();
        setUnit(['US', 'GB', 'LR', 'MM'].indexOf(c) >= 0 ? 'in' : 'cm');
      })();

      var product = {
        title: d.productTitle || '', type: d.productType || '',
        url: d.productUrl || '', domain: (d.shopDomain || location.hostname),
        desc: d.productDesc || ''
      };

      var modal = document.getElementById('styla-modal-' + blockId);
      if (modal && modal.parentNode !== document.body) document.body.appendChild(modal);
      var triggerBtn = document.getElementById('styla-trigger-btn-' + blockId);
      var closeBtn = document.getElementById('styla-close-' + blockId);
      var listEl = el('styla-text-list');
      var intentEl = el('styla-intent-text');
      var bestValEl = el('styla-best-size-val');
      var confEl = el('styla-conf');
      var lenBadgeEl = el('styla-answer-len');
      var intentCard = el('styla-intent-card');
      var discFit = el('styla-disc-fit');
      var discSizes = el('styla-disc-sizes'), sizesBody = el('styla-sizes-body');
      var discLen = el('styla-disc-len'), lenBody = el('styla-len-body');
      var discChart = el('styla-disc-chart'), chartBody = el('styla-chart-body');

      // One panel open at a time keeps the chat area clean — the whole point of
      // demoting these out of the always-on list.
      var PANELS = [['styla-lnk-fit', discFit], ['styla-lnk-sizes', discSizes],
                    ['styla-lnk-len', discLen], ['styla-lnk-chart', discChart]];
      PANELS.forEach(function (pair) {
        var btn = el(pair[0]), panel = pair[1];
        if (!btn || !panel) return;
        btn.addEventListener('click', function () {
          var open = !panel.classList.contains('styla-hidden');
          PANELS.forEach(function (o) {
            if (o[1]) o[1].classList.add('styla-hidden');
            var b = el(o[0]); if (b) b.setAttribute('aria-expanded', 'false');
          });
          if (!open) { panel.classList.remove('styla-hidden'); btn.setAttribute('aria-expanded', 'true'); }
        });
      });
      var suggestEl = el('styla-chat-suggest');
      var signoutBtn = el('styla-signout');
      var detailsBody = el('styla-details-body');
      var formPanel = el('styla-form');

      var STATE = { result: null, activeSize: null, loading: false, chatBusy: false, shopForId: null, people: [] };

      // ---------- open / close ----------
      triggerBtn.addEventListener('click', function () {
        modal.classList.remove('styla-hidden');
        document.body.style.overflow = 'hidden';
        paintAuth();
        renderShopFor();
        if (!STATE.result) loadFit();
      });
      function close() { modal.classList.add('styla-hidden'); document.body.style.overflow = ''; }
      closeBtn.addEventListener('click', close);
      modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

      // No tabs any more — answer and conversation share one scroll, so the
      // recommendation stays on screen while the shopper asks about it.

      // ---------- fetch the real fit ----------
      async function loadFit() {
        var profile = getProfile(), token = await ensureFreshToken();
        if (!profile && !token && !STATE.knownSize) { showForm(true); return; }
        setLoading(true);
        try {
          var body = { domain: product.domain, productUrl: product.url, category: mapType(product.type) };
          if (STATE.shopForProfile) body.profile = STATE.shopForProfile;   // shopping for someone else
          else if (STATE.knownSize) body.knownSize = STATE.knownSize;      // "I'm a 12 UK"
          else if (token) body.accessToken = token; else body.profile = profile;
          var r = await fetch(API + '/api/widget-size', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
          var data = await r.json();
          // Signed in, but no measurements saved yet (account created, quiz never
          // taken) -> ask the questions instead of claiming the brand has no chart.
          if (data && data.unknown_size) {
            showForm(true); showKnown(true);
            var km = el('styla-k-equiv'); if (km) km.textContent = data.message || 'We don\u2019t recognise that size.';
            return;
          }
          if (data && data.needs_profile) {
            showForm(true);
            var ft = el('styla-form-title');
            if (ft) ft.textContent = "You're signed in — a few quick questions and we'll have your size.";
            return;
          }
          // No size, or a chart that shares no comparable measurement with the shopper,
          // must NOT show a confident size — show the honest "can't size this" state.
          var noOverlap = data && data.candidates && data.candidates.every(function(c){ return !c.breakdown || !Object.keys(c.breakdown).length; });
          if (!data || !data.size || data.insufficient_data || noOverlap) { renderNoChart(); return; }
          STATE.result = data;
          STATE.activeSize = data.size;
          paintAuth();
          renderFit();
          renderShopFor();
        } catch (e) { renderError(); } finally { setLoading(false); }
      }

      // ---------- Continue with Styla (one-tap sign-in) ----------
      var _stylaPopup = null;
      function openStylaConnect() {
        var w = 460, h = 640;
        var x = Math.max(0, ((window.screenX || 0) + ((window.outerWidth || screen.width) - w) / 2));
        var y = Math.max(0, ((window.screenY || 0) + ((window.outerHeight || screen.height) - h) / 2));
        var url = STYLA_ORIGIN + '/connect.html?origin=' + encodeURIComponent(location.origin) +
          '&shop=' + encodeURIComponent(product.domain || location.hostname);
        _stylaPopup = window.open(url, 'styla_connect', 'width=' + w + ',height=' + h + ',left=' + x + ',top=' + y);
      }
      // Receive the session the popup posts back. Verify it's really from Styla.
      window.addEventListener('message', function (ev) {
        if (ev.origin !== STYLA_ORIGIN) return;
        var d = ev.data || {};
        if (d.type !== 'styla-auth' || !d.access_token) return;
        setSession(d);
        paintAuth();   // reflect the new session NOW — sign-out must appear
        try { if (_stylaPopup) _stylaPopup.close(); } catch (e) {}
        var cta = detailsBody && detailsBody.querySelector('.styla-save-cta'); if (cta) cta.remove();
        hideForm();
        STATE.result = null; STATE.shopForId = null; STATE.shopForProfile = null;
        loadFit();
      });
      // Inject a "Continue with Styla" button at the top of the guest form.
      function ensureConnectBtn() {
        paintAuth();
        if (!formPanel) return;
        // Already signed in? Then don't ask them to sign in again — that was
        // reading as "log in every time" even though the session was valid.
        if (getToken()) {
          var old = formPanel.querySelector('.styla-connect-wrap');
          if (old) old.remove();
          return;
        }
        if (formPanel.querySelector('.styla-connect-wrap')) return;
        var wrap = document.createElement('div');
        wrap.className = 'styla-connect-wrap';
        wrap.innerHTML = '<button type="button" class="styla-connect-btn">Continue with Styla</button>' +
          '<div class="styla-connect-or">Have a Styla profile? One tap — no measuring.</div>';
        formPanel.insertBefore(wrap, formPanel.firstChild);
        wrap.querySelector('.styla-connect-btn').addEventListener('click', openStylaConnect);
      }

      // ---- shop for someone who shares their size with you ----
      async function conn(action, extra) {
        var token = getToken(); if (!token) return {};
        return (await fetch(API + '/api/store-api?route=connections', { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify(Object.assign({ action: action }, extra || {})) })).json();
      }
      // "Shopping for" — buying for a partner, a bridesmaid, a kid. This is a real
      // differentiator and it was buried inside the collapsed panels area where
      // nobody would find it, so it now lives in the sub-header beside the size.
      // "Shopping for" — buying for a partner, a bridesmaid, a kid. Two sources:
      // people who SHARED their Styla profile (exact, needs sign-in) and people
      // the shopper estimated here in the widget (no sign-in, stays local).
      // Two buttons, not a dropdown: "Me" vs "Someone else" is a mode, and a mode
      // should be visible at a glance rather than hidden behind a select.
      async function renderShopFor() {
        var slot = el('styla-shopfor-slot'); if (!slot) return;

        var local = getPeople().map(function (p) { return { id: p.id, label: p.name, profile: p.profile }; });
        var shared = [];
        if (getToken()) {
          try {
            var d = await conn('list');
            shared = (d.sharedWithMe || []).map(function (p) {
              return { id: p.owner_id, label: (p.owner_name || p.owner_email || 'Someone') +
                (p.relationship ? ' \u00b7 ' + p.relationship : '') };
            });
          } catch (e) {}
        }
        STATE.people = shared;
        var people = shared.concat(local);
        var forOther = !!STATE.shopForId;

        var chips = people.map(function (p) {
          return '<button type="button" class="styla-who' + (p.id === STATE.shopForId ? ' on' : '') +
                 '" data-id="' + esc(p.id) + '">' + esc(p.label) + '</button>';
        }).join('');

        slot.innerHTML =
          '<div class="styla-mode">' +
            '<button type="button" class="styla-mode-btn' + (forOther ? '' : ' on') + '" data-mode="me">Shop for me</button>' +
            '<button type="button" class="styla-mode-btn' + (forOther ? ' on' : '') + '" data-mode="other">Shop for a friend</button>' +
          '</div>' +
          (forOther ? ('<div class="styla-who-row">' + chips +
            '<button type="button" class="styla-who styla-who-add" data-id="__add">+ Add someone</button></div>') : '');

        slot.querySelectorAll('.styla-mode-btn').forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.getAttribute('data-mode') === 'me') {
              if (!STATE.shopForId) return;
              STATE.shopForId = null; STATE.shopForProfile = null;
              slot.innerHTML = ''; renderShopFor();
              STATE.result = null; loadFit();
            } else {
              // No one saved yet -> go straight to the questions.
              if (!people.length) { showFormForOther(); return; }
              if (!STATE.shopForId) selectPerson(people[0]);
            }
          });
        });

        slot.querySelectorAll('.styla-who').forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-id');
            if (id === '__add') { showFormForOther(); return; }
            selectPerson(people.filter(function (p) { return p.id === id; })[0]);
          });
        });

        async function selectPerson(p) {
          if (!p) return;
          STATE.shopForId = p.id;
          if (p.profile) STATE.shopForProfile = p.profile;         // estimated here
          else {
            try {
              var pr = (await conn('get-profile', { ownerId: p.id })).profile || {};
              STATE.shopForProfile = { chest: pr.chest, waist: pr.waist, belly: pr.belly || pr.waist,
                hips: pr.hips, shoulder: pr.shoulder, height: pr.height, inseam: pr.inseam };
            } catch (e) { return; }
          }
          slot.innerHTML = ''; renderShopFor();
          STATE.result = null; loadFit();
        }
      }




      // Rough Shopify product.type -> Styla measurement category.
      function mapType(t) {
        t = (t || '').toLowerCase();
        if (/dress|gown/.test(t)) return 'dresses';
        if (/suit|blazer|tux/.test(t)) return 'suits';
        if (/jean|pant|trouser|chino/.test(t)) return 'pants';
        if (/short/.test(t)) return 'shorts';
        if (/legging/.test(t)) return 'leggings';
        if (/skirt/.test(t)) return 'skirts';
        if (/coat|jacket|outerwear|parka/.test(t)) return 'outerwear';
        if (/bra|lingerie/.test(t)) return 'bras';
        if (/swim|bikini/.test(t)) return 'swimwear';
        return 'tops';
      }

      // ---------- render ----------
      function renderFit() {
        renderAlternatives();
        renderLengths();
        renderChart();
        renderSize(STATE.activeSize);
      }

      // ---- Compare other sizes (inline, no navigation) ----
      function renderAlternatives() {
        var res = STATE.result, cands = res.candidates || [];
        if (!sizesBody) return;
        var lnkSizes = el('styla-lnk-sizes');
        if (cands.length < 2) { if (lnkSizes) lnkSizes.classList.add('styla-hidden'); return; }
        if (lnkSizes) lnkSizes.classList.remove('styla-hidden');
        var st = res.stock || null;
        sizesBody.innerHTML = cands.map(function (c) {
          var oos = false;
          if (st) { var k = Object.keys(st).find(function (x) { return x.toLowerCase() === String(c.name).trim().toLowerCase(); });
                    if (k) oos = !st[k]; }
          var note = c.name === res.size ? cap(c.spectrum || '') + ' — best match'
                   : (c.fits ? cap(c.spectrum || '') + ' on you' : 'Compromises fit');
          return '<div class="styla-alt' + (c.name === res.size ? ' is-best' : '') + (oos ? ' oos' : '') +
            '" data-size="' + esc(c.name) + '" role="button" tabindex="0">' +
            '<span class="styla-alt-name">' + esc(c.name) + '</span>' +
            '<span class="styla-alt-note">' + esc(note) + (oos ? ' · sold out' : '') + '</span></div>';
        }).join('');
        sizesBody.querySelectorAll('.styla-alt').forEach(function (r) {
          r.addEventListener('click', function () { STATE.activeSize = r.getAttribute('data-size'); renderSize(STATE.activeSize); });
        });
      }

      // ---- Length options exactly as the store defined them ----
      function renderLengths() {
        var res = STATE.result;
        var opts = (res.chart && res.chart.length_options) || res.length_options || [];
        if (!lenBody || !discLen) return;
        var lnkLen = el('styla-lnk-len');
        if (!opts.length) { if (lnkLen) lnkLen.classList.add('styla-hidden'); return; }
        if (lnkLen) lnkLen.classList.remove('styla-hidden');
        var picked = (res.recommendedLength && res.recommendedLength.name) || null;
        lenBody.innerHTML = opts.map(function (o) {
          var bits = [];
          if (o.inseam != null) bits.push('inseam ' + o.inseam + '"');
          if (o.height_min != null || o.height_max != null) bits.push('for ' + ftin(o.height_min) + '–' + ftin(o.height_max));
          if (o.note) bits.push(o.note);
          return '<div class="styla-alt' + (o.name === picked ? ' is-best' : '') + '">' +
            '<span class="styla-alt-name">' + esc(o.name) + '</span>' +
            '<span class="styla-alt-note">' + esc(bits.join(' · ')) + '</span></div>';
        }).join('');
      }
      function ftin(v) { if (v == null) return '—'; var f = Math.floor(v / 12), i = Math.round(v - f * 12); return f + "'" + i + '"'; }

      // ---- The brand's own size chart, every column they published ----
      function renderChart() {
        var ch = STATE.result && STATE.result.chart;
        if (!chartBody || !discChart) return;
        var rows = ch && (ch.display_sizes || ch.sizes);
        var lnkChart = el('styla-lnk-chart');
        if (!rows || !rows.length) { if (lnkChart) lnkChart.classList.add('styla-hidden'); return; }
        if (lnkChart) lnkChart.classList.remove('styla-hidden');
        var cols = (ch.display_columns && ch.display_columns.length) ? ch.display_columns
          : Object.keys(rows[0]).filter(function (k) { return k !== 'name'; });
        var best = STATE.result.size;
        var head = '<tr><th>Size</th>' + cols.map(function (c) { return '<th>' + esc(cap(c)) + '</th>'; }).join('') + '</tr>';
        var body = rows.map(function (r) {
          var cells = cols.map(function (c) {
            var v = r[c]; if (v == null) { var kk = Object.keys(r).find(function (k) { return k.toLowerCase() === String(c).toLowerCase(); }); if (kk) v = r[kk]; }
            if (Array.isArray(v)) v = v.join('–');
            return '<td>' + esc(v == null ? '—' : String(v)) + '</td>';
          }).join('');
          return '<tr class="' + (r.name === best ? 'is-best' : '') + '"><td>' + esc(r.name || '') + '</td>' + cells + '</tr>';
        }).join('');
        var note = (ch.notes || STATE.result.notes) ? '<p class="styla-alt-note" style="text-align:left;margin-top:10px">' + esc(ch.notes || STATE.result.notes) + '</p>' : '';
        chartBody.innerHTML = '<table>' + head + body + '</table>' + note;
      }

      function renderSize(sizeName) {
        var res = STATE.result;
        var cands = res.candidates || [];
        var c = cands.find(function (x) { return x.name === sizeName; }) ||
                { name: sizeName, spectrum: res.spectrum, breakdown: res.breakdown, fits: res.fits };
        bestValEl.textContent = sizeName || res.size;
        // A label-derived answer is a band, not a body — say so rather than
        // showing the same confidence as a real profile.
        var df = res.derived_from;
        if (confEl) {
          if (df && df.label) {
            confEl.textContent = 'Estimated from ' + String(df.system || '').toUpperCase() + ' ' + df.size;
            confEl.title = 'Based on standard sizing for that label, not your own measurements.';
          } else if (df && df.brandChart) {
            confEl.textContent = 'Matched to your ' + df.size + ' at ' + (res.source_brand || 'that brand');
          } else {
            confEl.textContent = (res.score != null ? res.score + '% match' : '');
            confEl.title = '';
          }
        }

        var rl = res.recommendedLength;
        if (lenBadgeEl) lenBadgeEl.textContent = (rl && rl.name) ? 'Suggested length: ' + rl.name : '';

        // Prefer the structured facts (translatable + unit-aware). Fall back to
        // the server's English prose only if an older response arrives.
        var fx = c.facts || {}, bk = c.breakdown || {};
        var keys = Object.keys(fx).length ? Object.keys(fx) : Object.keys(bk);
        listEl.innerHTML = keys.length ? keys.map(function (k) {
          var f = fx[k];
          var label = f ? factLabel(f, k) : dimLabel(k);
          var note  = f ? factText(f) : bk[k];
          var badge = f ? factBadge(f) : badgeFor(bk[k]);
          var cls   = f ? (f.verdict === 'info' ? 'info' : (!f.ok ? 'slim' : f.verdict)) : statusFor(bk[k]);
          return '<li><span class="styla-fit-dim">' + esc(label) + '</span>' +
            '<span class="styla-fit-note">' + esc(note) + '</span>' +
            (badge ? '<span class="styla-fit-tag ' + esc(cls) + '">' + esc(badge) + '</span>' : '') + '</li>';
        }).join('') : '<li><span class="styla-fit-note">This brand\'s chart doesn\'t share a measurement we can compare.</span></li>';

        var st = res.stock, stockTxt = '';
        if (st) { var sk = Object.keys(st).find(function (x) { return x.toLowerCase() === String(sizeName).trim().toLowerCase(); });
                  if (sk) stockTxt = st[sk] ? 'In stock.' : 'Sold out in this size.'; }
        var verb = (sizeName === res.size)
          ? 'Your best fit — ' + cap(c.spectrum || res.spectrum) + '.'
          : (c.fits ? cap(c.spectrum) + ' on you' : 'Not recommended') + ' vs. your best size ' + res.size + '.';
        if (intentEl) intentEl.textContent = [verb, stockTxt].filter(Boolean).join(' ');
        // stock is the one thing worth showing WITHOUT opening a panel
        var meta = el('styla-conf');
        if (meta && stockTxt) meta.textContent = (res.score != null ? res.score + '% match · ' : '') + stockTxt;
        if (sizesBody) sizesBody.querySelectorAll('.styla-alt').forEach(function (r) {
          r.classList.toggle('is-active', r.getAttribute('data-size') === sizeName);
        });
        ensureAskChips();
        maybeShowSave();
      }

      // Progressive disclosure: once they have a size, surface follow-ups the AI
      // can actually answer from data we hold (fit, stock, this store's catalog).
      // Deliberately no shipping/returns prompts — we don't hold that.
      function ensureAskChips() {
        if (!suggestEl || suggestEl.childElementCount) return;
        var qs = ['Does it run small?', 'What if I size up?'];
        if (STATE.result && STATE.result.stock) qs.unshift('Is my size in stock?');
        var lens = (STATE.result && ((STATE.result.chart && STATE.result.chart.length_options) || STATE.result.length_options)) || [];
        if (lens.length) qs.push('Short, regular or long?');
        if (product.domain) qs.push('What else here would fit me?');
        suggestEl.innerHTML = qs.map(function (q) {
          return '<button type="button" class="styla-chip">' + esc(q) + '</button>';
        }).join('');
        suggestEl.querySelectorAll('.styla-chip').forEach(function (b) {
          b.addEventListener('click', function () {
            // Same panel now — no tab to switch to. Just ask it.
            if (chatInput) { chatInput.value = b.textContent; sendChat(); }
          });
        });
      }

      // Guests: after they see their size, offer to save it as a free Styla account
      // (keeps their size across this store's pages, and pitches Styla).
      function maybeShowSave() {
        if (getToken() || !getProfile()) return; // already signed in, or nothing to save
        var host = detailsBody; if (!host || host.querySelector('.styla-save-cta')) return;
        var box = document.createElement('div');
        box.className = 'styla-save-cta';
        box.innerHTML =
          '<div class="styla-save-head">Save your size &amp; shop everywhere with Styla</div>' +
          '<div class="styla-save-sub">Free account · your size in every brand you shop · no tape measure.</div>' +
          '<input class="styla-save-email" type="email" placeholder="Email" autocomplete="email"/>' +
          '<input class="styla-save-pass" type="password" placeholder="Create a password" autocomplete="new-password"/>' +
          '<button type="button" class="styla-save-btn">Save my size — free</button>' +
          '<div class="styla-save-alt">Already use Styla? <button type="button" class="styla-connect-link">Continue with Styla</button></div>' +
          '<div class="styla-save-msg"></div>';
        host.appendChild(box);
        var connLink = box.querySelector('.styla-connect-link');
        if (connLink) connLink.addEventListener('click', openStylaConnect);
        box.querySelector('.styla-save-btn').addEventListener('click', function () {
          var email = (box.querySelector('.styla-save-email').value || '').trim();
          var pass = box.querySelector('.styla-save-pass').value || '';
          var msg = box.querySelector('.styla-save-msg');
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || pass.length < 6) { msg.textContent = 'Enter a valid email and a 6+ character password.'; return; }
          msg.style.color = ''; msg.textContent = 'Saving…';
          var prof = getProfile();
          fetch(API + '/api/store-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'styla-register', username: email, password: pass, manual_measurements: prof }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (d.error) { msg.textContent = d.error; return; }
              if (d.access_token) { try { localStorage.setItem(LS_TOKEN, d.access_token); } catch (e) {} }
              box.innerHTML = '<div class="styla-save-head">✓ Saved — you’re in!</div><div class="styla-save-sub">Your Styla size profile is ready. Look for the Styla button on other stores.</div>';
            })
            .catch(function () { msg.textContent = 'Could not save right now — try again.'; });
        });
      }
      function showNote(text) {
        // The chat is right below now — no tab to point at.
        if (discFit) discFit.classList.remove('styla-hidden');
        if (intentEl) intentEl.textContent = text;
      }
      function renderNoChart() {
        listEl.innerHTML = '';
        bestValEl.textContent = '—';
        if (confEl) confEl.textContent = '';
        ['styla-lnk-fit','styla-lnk-sizes','styla-lnk-len','styla-lnk-chart'].forEach(function (id) {
          var b = el(id); if (b) b.classList.add('styla-hidden');
        });
        showNote('We don\u2019t have this brand\u2019s size chart yet, so we can\u2019t compute your size. Ask below and I\u2019ll help from the product details.');
        ensureAskChips();
      }
      function renderError() { showNote('Something went wrong reaching Styla. Please try again in a moment.'); }
      function setLoading(on) {
        STATE.loading = on;
        if (on) { bestValEl.textContent = '…'; intentEl.textContent = 'Matching this garment to your measurements…'; listEl.innerHTML = ''; }
      }

      // ---------- guest measurement form ----------
      var editBtn = el('styla-edit-specs'), cancelBtn = el('styla-cancel-specs'), saveBtn = el('styla-save-specs');
      function showForm(first) { ensureConnectBtn(); formPanel.classList.remove('styla-hidden'); detailsBody.classList.add('styla-hidden'); if (first) intentEl.textContent = ''; }

      // Shopping for someone else runs the SAME questionnaire, answered about
      // them. Sending the shopper off to styla.ca lost them mid-purchase; this
      // keeps the whole thing in the widget.
      function setSelfQuizVisible(v) {
        ['styla-form-title', 'styla-quiz', 'styla-manual'].forEach(function (id) {
          var n = el(id); if (n) n.classList.toggle('styla-hidden', !v);
        });
        var acts = formPanel && formPanel.querySelector('.styla-form-actions');
        if (acts) acts.classList.toggle('styla-hidden', !v);
      }
      function showFormForOther() {
        STATE.forOther = true;
        var box = el('styla-forwho'); if (box) box.classList.remove('styla-hidden');
        var nameEl = el('styla-forwho-name'); if (nameEl) nameEl.value = '';
        setSelfQuizVisible(false);             // the self-quiz asks things you can't know about a friend
        var wrap = formPanel && formPanel.querySelector('.styla-connect-wrap');
        if (wrap) wrap.remove();               // this isn't a sign-in moment
        showForm(false);
      }
      function exitOtherMode() {
        STATE.forOther = false;
        var box = el('styla-forwho'); if (box) box.classList.add('styla-hidden');
        setSelfQuizVisible(true);
      }
      function hideForm() { formPanel.classList.add('styla-hidden'); detailsBody.classList.remove('styla-hidden'); }
      if (editBtn) editBtn.addEventListener('click', function () { showForm(false); });
      if (cancelBtn) cancelBtn.addEventListener('click', hideForm);
      // ---------- questionnaire (default) vs exact measurements ----------
      var QZ = { gender: 'women', fit: 'regular' };
      function qEl(id) { return el(id); }
      function setSeg(host, attr, val, key) {
        if (!host) return;
        host.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute(attr) === val); });
        QZ[key] = val;
      }
      var segG = el('styla-q-gender'), segF = el('styla-q-fit');
      if (segG) segG.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        setSeg(segG, 'data-g', b.getAttribute('data-g'), 'gender');
        var w = el('styla-q-women'), m = el('styla-q-men');
        if (w) w.style.display = QZ.gender === 'women' ? '' : 'none';
        if (m) m.style.display = QZ.gender === 'men' ? '' : 'none';
      });
      if (segF) segF.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        setSeg(segF, 'data-f', b.getAttribute('data-f'), 'fit');
      });
      function bindRange(id, lbl, fmt) {
        var r = el(id), l = el(lbl); if (!r || !l) return;
        var upd = function () { l.textContent = fmt(+r.value); };
        r.addEventListener('input', upd); upd();
      }
      bindRange('styla-q-height', 'styla-q-hlbl', function (v) { return Math.floor(v / 12) + "'" + (v % 12) + '"'; });
      bindRange('styla-q-weight', 'styla-q-wlbl', function (v) { return v + ' lb'; });
      bindRange('styla-q-ww', 'styla-q-wwlbl', function (v) { return v + ' in'; });
      bindRange('styla-q-wm', 'styla-q-wmlbl', function (v) { return v + ' in'; });

      var toManual = el('styla-to-manual'), toQuiz = el('styla-to-quiz');
      function mode(manual) {
        var q = el('styla-quiz'), m = el('styla-manual'), t = el('styla-form-title');
        if (q) q.style.display = manual ? 'none' : '';
        if (m) m.style.display = manual ? '' : 'none';
        if (t) t.textContent = manual ? 'Enter your measurements (inches).' : 'A few quick questions — no tape measure needed.';
      }
      if (toManual) toManual.addEventListener('click', function () { mode(true); });
      if (toQuiz) toQuiz.addEventListener('click', function () { mode(false); });

      // Same estimation model as the Styla questionnaire on styla.ca.
      function profileFromQuiz() {
        var h = +(el('styla-q-height') || {}).value || 66;
        var w = +(el('styla-q-weight') || {}).value || 150;
        var bmi = (w / (h * h)) * 703;
        var p = { height: h };
        if (QZ.gender === 'women') {
          var band = parseFloat((el('styla-q-band') || {}).value) || 34;
          var cup = (el('styla-q-cup') || {}).value || 'B';
          var cupMod = ({ A: 1, B: 2, C: 3, D: 4, DD: 5, F: 6 })[cup] || 2;
          p.chest = band + cupMod;
          p.waist = +(el('styla-q-ww') || {}).value || 28;
          var drop = QZ.fit === 'loose' ? 6 : QZ.fit === 'snug' ? 1 : 3.5;
          p.hips = Math.round((p.waist + drop + 2 + bmi * 0.2) * 10) / 10;
          p.inseam = Math.round(h * 0.45);
        } else {
          p.waist = +(el('styla-q-wm') || {}).value || 32;
          var shirt = (el('styla-q-shirt') || {}).value || 'M';
          var chest = ({ XS: 35, S: 37, M: 40, L: 43, XL: 46, XXL: 49 })[shirt] || (p.waist + 6);
          if (QZ.fit === 'loose') chest += 1.5;
          if (QZ.fit === 'snug') chest -= 1.5;
          p.chest = chest;
          p.neck = Math.round((12.5 + (chest - 38) * 0.15) * 10) / 10;
          p.hips = Math.round((p.waist + 2 + bmi * 0.15) * 10) / 10;
          p.inseam = Math.round(h * 0.44);
        }
        p.belly = p.waist;
        return p;
      }
      // Height IS a body measurement — and it's the one that decides Short/Regular/
      // Long on suits, jackets and dresses. Required here, same as the quiz.
      // (Weight isn't asked: it's only used to *estimate* girths in the quiz, and
      // here the shopper is giving us the real ones.)
      function profileFromManual() {
        var num = function (id) { var v = parseFloat((el(id) || {}).value); return isNaN(v) ? undefined : v; };
        var chest = num('styla-in-chest'), waist = num('styla-in-waist'), height = num('styla-in-height');
        if (!chest || !waist || !height) return null;
        var hips = num('styla-in-hips');
        return {
          chest: chest, waist: waist, belly: waist,
          hips: hips || (waist + 4),
          height: height, shoulder: num('styla-in-shoulders'), inseam: num('styla-in-inseam'),
        };
      }
      var forWhoName = el('styla-forwho-name');
      if (forWhoName) forWhoName.addEventListener('input', function () { this.classList.remove('styla-invalid'); });
      if (cancelBtn) cancelBtn.addEventListener('click', exitOtherMode);

      if (saveBtn) saveBtn.addEventListener('click', function () {
        var manual = el('styla-manual') && el('styla-manual').style.display !== 'none';
        var p = manual ? profileFromManual() : profileFromQuiz();
        if (!p) { var t = el('styla-form-title'); if (t) t.textContent = 'Chest, waist and height are needed — height decides Short/Regular/Long.'; return; }

        setProfile(p);
        hideForm();
        STATE.result = null; loadFit();
      });


      // ---------- Gift estimation ----------
      //
      // Deliberately NOT the self-questionnaire. Weight, bra band and exact waist
      // are things almost nobody knows about a friend, and asking is intrusive.
      // What a gift-buyer genuinely knows is: who it's for, roughly how tall they
      // are, the size they usually wear, and their general build. So we invert a
      // standard size table instead of estimating girths from body mass.
      var GIFT_W = {  // US women's, body measurements in inches
        XS:  { chest: 32.5, waist: 25.0, hips: 35.5 },
        S:   { chest: 34.5, waist: 27.0, hips: 37.5 },
        M:   { chest: 36.5, waist: 29.0, hips: 39.5 },
        L:   { chest: 39.5, waist: 32.0, hips: 42.5 },
        XL:  { chest: 43.0, waist: 35.5, hips: 46.0 },
        XXL: { chest: 46.5, waist: 39.0, hips: 49.5 },
      };
      var GIFT_M = {  // US men's
        XS:  { chest: 34, waist: 28 }, S:   { chest: 36, waist: 30 },
        M:   { chest: 40, waist: 33 }, L:   { chest: 43, waist: 36 },
        XL:  { chest: 46, waist: 39 }, XXL: { chest: 49, waist: 43 },
      };
      var GIFT_HEIGHT = { women: { petite: 61, average: 65, tall: 69 },
                          men:   { petite: 66, average: 70, tall: 74 } };

      function profileFromGift() {
        var g = GIFT.gender === 'men' ? 'men' : 'women';
        var size = GIFT.size || 'M';
        var height = GIFT_HEIGHT[g][GIFT.height || 'average'];
        // Build nudges girths without pretending we know a number.
        var adj = GIFT.build === 'slim' ? -1.0 : GIFT.build === 'curvy' ? 1.5 : 0;

        var p = { height: height };
        if (g === 'women') {
          var b = GIFT_W[size] || GIFT_W.M;
          p.chest = +(b.chest + adj).toFixed(1);
          p.waist = +(b.waist + adj).toFixed(1);
          p.hips  = +(b.hips + (GIFT.build === 'curvy' ? adj + 0.5 : adj)).toFixed(1);
          p.inseam = Math.round(height * 0.45);
        } else {
          var m = GIFT_M[size] || GIFT_M.M;
          p.chest = +(m.chest + adj).toFixed(1);
          p.waist = +(m.waist + adj).toFixed(1);
          p.hips  = +(m.waist + 2 + adj).toFixed(1);
          p.neck  = +(12.5 + (p.chest - 38) * 0.15).toFixed(1);
          p.inseam = Math.round(height * 0.44);
        }
        p.belly = p.waist;
        p.estimated = true;   // so the UI can be honest about confidence
        return p;
      }

      var GIFT = { gender: 'women', size: 'M', height: 'average', build: 'average' };
      function bindGiftSeg(id, key, after) {
        var host = el(id); if (!host) return;
        host.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          host.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
          GIFT[key] = b.getAttribute('data-v');
          if (after) after();
        });
      }
      bindGiftSeg('styla-g-gender', 'gender', function () {
        var h = el('styla-g-hhint');
        if (h) h.textContent = GIFT.gender === 'men'
          ? 'Average is about 5\u201910\u201d. This decides Short / Regular / Long.'
          : 'Average is about 5\u20194\u201d\u20135\u20198\u201d. This decides Short / Regular / Long.';
      });
      bindGiftSeg('styla-g-size', 'size');
      bindGiftSeg('styla-g-height', 'height');
      bindGiftSeg('styla-g-build', 'build');

      var giftSave = el('styla-g-save'), giftCancel = el('styla-g-cancel');
      if (giftCancel) giftCancel.addEventListener('click', function () { exitOtherMode(); hideForm(); });
      if (giftSave) giftSave.addEventListener('click', function () {
        var p = profileFromGift();
        var nameEl = el('styla-forwho-name');
        // Name is OPTIONAL — it only labels the saved entry. Nothing about the
        // size recommendation needs it.
        var name = ((nameEl && nameEl.value) || '').trim() ||
                   ('Friend ' + (getPeople().length + 1));
        var person = { id: 'local:' + Date.now().toString(36), name: name, profile: p, local: true };
        savePerson(person);
        STATE.shopForId = person.id;
        STATE.shopForProfile = p;
        exitOtherMode(); hideForm();
        var slot = el('styla-shopfor-slot'); if (slot) slot.innerHTML = '';
        STATE.result = null; loadFit();
      });


      // ---------- "I already know my size" ----------
      // The conversion table lives on the server (shared/size-conversion.js), so
      // there's one definition and so a named brand can be inverted against its
      // real chart. The widget only collects.
      var KNOWN = { system: 'us', build: 'average' };
      function bindKnownSeg(id, key) {
        var host = el(id); if (!host) return;
        host.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          host.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
          KNOWN[key] = b.getAttribute('data-v');
        });
      }
      bindKnownSeg('styla-k-system', 'system');
      bindKnownSeg('styla-k-build', 'build');

      function showKnown(v) {
        var k = el('styla-known'); if (!k) return;
        k.classList.toggle('styla-hidden', !v);
        ['styla-quiz', 'styla-manual', 'styla-form-title'].forEach(function (id) {
          var n = el(id); if (n) n.classList.toggle('styla-hidden', v);
        });
        var acts = formPanel && formPanel.querySelectorAll('.styla-form-actions');
        if (acts && acts.length) acts[acts.length - 1].classList.toggle('styla-hidden', v);
      }
      var toKnown = el('styla-to-known');
      if (toKnown) toKnown.addEventListener('click', function () { showKnown(true); });
      var kCancel = el('styla-k-cancel');
      if (kCancel) kCancel.addEventListener('click', function () { showKnown(false); });

      var kSave = el('styla-k-save');
      if (kSave) kSave.addEventListener('click', async function () {
        var size = ((el('styla-k-size') || {}).value || '').trim();
        var ft = parseFloat((el('styla-k-hft') || {}).value);
        var inch = parseFloat((el('styla-k-hin') || {}).value);
        var msg = el('styla-k-equiv');

        if (!size) { if (msg) msg.textContent = 'Enter the size you usually wear.'; return; }
        if (isNaN(ft)) {
          // Required, and worth explaining rather than just rejecting.
          if (msg) msg.textContent = 'Height is needed — a size label doesn\u2019t say how tall you are, and that decides Short / Regular / Long.';
          return;
        }
        var heightIn = ft * 12 + (isNaN(inch) ? 0 : inch);
        STATE.knownSize = {
          system: KNOWN.system, size: size, build: KNOWN.build,
          gender: (QZ && QZ.gender) === 'men' ? 'men' : 'women',
          heightIn: heightIn,
          brand: ((el('styla-k-brand') || {}).value || '').trim() || undefined,
        };
        showKnown(false); hideForm();
        STATE.result = null;
        loadFit();
      });

      // ---------- AI Tailor chat (streamed) ----------
      var chatHistory = el('styla-chat-history'), chatInput = el('styla-chat-input'), chatSend = el('styla-chat-send');
      var CHAT = [];
      function bubble(cls) {
        var b = document.createElement('div'); b.className = 'chat-msg ' + cls;
        var p = document.createElement('p'); b.appendChild(p);
        chatHistory.appendChild(b); chatHistory.scrollTop = chatHistory.scrollHeight; return p;
      }
      // Composer behaviour: Enter sends, Shift+Enter starts a new line, and the
      // box grows with the text up to ~5 lines. It's a textarea now, so people
      // can actually write more than one line.
      function autoGrow() {
        if (!chatInput) return;
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 132) + 'px';
      }
      if (chatInput) {
        chatInput.addEventListener('input', autoGrow);
        chatInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            sendChat();
          }
        });
      }

      // --- sign out ---
      function paintAuth() {
        var signedIn = !!getToken();
        if (signoutBtn) signoutBtn.classList.toggle('styla-hidden', !signedIn);
        var sub = el('styla-head-sub');
        if (sub) sub.textContent = signedIn ? 'Signed in with Styla' : 'Fit & size advice for your body';
      }
      if (signoutBtn) {
        signoutBtn.addEventListener('click', function () {
          // Clear the Styla session AND the guest measurements held for this
          // store, otherwise "signed out" would still show their body data.
          clearSession();
          try { localStorage.removeItem(LS_PROFILE); } catch (e) {}
          STATE.result = null; STATE.activeSize = null;
          STATE.shopForId = null; STATE.shopForProfile = null; STATE.people = [];
          var slot = el('styla-shopfor-slot'); if (slot) slot.innerHTML = '';
          paintAuth();
          showForm(true);
          ensureConnectBtn();
        });
      }

      async function sendChat() {
        var q = (chatInput.value || '').trim(); if (!q || STATE.chatBusy) return;
        chatInput.value = ''; autoGrow();
        bubble('user').textContent = q;
        CHAT.push({ role: 'user', text: q });
        var out = bubble('system'); out.innerHTML = '<span class="styla-typing"><i></i><i></i><i></i></span>';
        STATE.chatBusy = true;
        var profile = getProfile(), token = getToken();
        var payload = {
          stream: true, recommendedSize: STATE.result ? STATE.result.size : null,
          pageTitle: product.title, pageText: product.desc,
          // store context -> lets the AI reason across this shop's whole catalog
          // (not just the current product) when the shopper asks for alternatives.
          domain: product.domain, shop: product.domain, category: mapType(product.type),
          locale: LOCALE, units: UNIT,
          // Full brand chart (every column) so the AI can answer questions about any measurement.
          sizeChart: STATE.result ? (STATE.result.chart || { sizes: (STATE.result.candidates || []) }) : null,
          stock: STATE.result ? STATE.result.stock : null,   // live per-size availability
          history: CHAT
        };
        if (token) payload.accessToken = token;
        else if (profile) { payload.chest = profile.chest; payload.waist = profile.waist; payload.belly = profile.belly || profile.waist; payload.hips = profile.hips; payload.shoulder = profile.shoulder; }
        else { payload.chest = 38; payload.waist = 31; payload.belly = 31; payload.hips = 40; }
        try {
          var r = await fetch(API + '/api/extension-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          var ctype = (r.headers.get('content-type') || '');
          var acc = '';

          // Only treat it as a stream when the server actually said so. The old
          // code read ANY body as a stream (getReader always exists), so a JSON
          // error — or an empty body — silently produced a blank bubble.
          if (r.ok && ctype.indexOf('text/plain') === 0 && r.body && r.body.getReader) {
            var reader = r.body.getReader(), decr = new TextDecoder();
            out.textContent = '';
            while (true) {
              var chunk = await reader.read();
              if (chunk.done) break;
              acc += decr.decode(chunk.value, { stream: true });
              out.textContent = acc;
              chatHistory.scrollTop = chatHistory.scrollHeight;
            }
          } else {
            var data = null;
            try { data = await r.json(); } catch (e) {}
            acc = (data && (data.reply || data.error)) || '';
          }

          // Never leave an empty bubble — say something the shopper can act on.
          if (!acc.trim()) acc = "Sorry — I couldn't answer that just now. Please try again.";
          out.textContent = acc;
          CHAT.push({ role: 'model', text: acc });
        } catch (e) { out.textContent = 'Sorry — I couldn’t answer just now. Try again?'; }
        STATE.chatBusy = false;
      }
      if (chatSend) chatSend.addEventListener('click', sendChat);
      if (chatInput) chatInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') sendChat(); });
    });
  });
})();
