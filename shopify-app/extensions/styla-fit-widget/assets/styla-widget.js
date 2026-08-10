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

      var product = {
        title: d.productTitle || '', type: d.productType || '',
        url: d.productUrl || '', domain: (d.shopDomain || location.hostname),
        desc: d.productDesc || ''
      };

      var modal = document.getElementById('styla-modal-' + blockId);
      var triggerBtn = document.getElementById('styla-trigger-btn-' + blockId);
      var closeBtn = document.getElementById('styla-close-' + blockId);
      var listEl = el('styla-text-list');
      var intentEl = el('styla-intent-text');
      var bestValEl = el('styla-best-size-val');
      var confEl = el('styla-conf');
      var lenBadgeEl = el('styla-answer-len');
      var intentCard = el('styla-intent-card');
      var discSizes = el('styla-disc-sizes'), sizesBody = el('styla-sizes-body');
      var discLen = el('styla-disc-len'), lenBody = el('styla-len-body');
      var discChart = el('styla-disc-chart'), chartBody = el('styla-chart-body');
      var suggestEl = el('styla-chat-suggest');
      var detailsBody = el('styla-details-body');
      var formPanel = el('styla-form');

      var STATE = { result: null, activeSize: null, loading: false, chatBusy: false, shopForId: null, people: [] };

      // ---------- open / close ----------
      triggerBtn.addEventListener('click', function () {
        modal.classList.remove('styla-hidden');
        document.body.style.overflow = 'hidden';
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
        if (!profile && !token) { showForm(true); return; }
        setLoading(true);
        try {
          var body = { domain: product.domain, productUrl: product.url, category: mapType(product.type) };
          if (STATE.shopForProfile) body.profile = STATE.shopForProfile;   // shopping for someone else
          else if (token) body.accessToken = token; else body.profile = profile;
          var r = await fetch(API + '/api/widget-size', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
          var data = await r.json();
          // Signed in, but no measurements saved yet (account created, quiz never
          // taken) -> ask the questions instead of claiming the brand has no chart.
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
        try { if (_stylaPopup) _stylaPopup.close(); } catch (e) {}
        var cta = detailsBody && detailsBody.querySelector('.styla-save-cta'); if (cta) cta.remove();
        hideForm();
        STATE.result = null; STATE.shopForId = null; STATE.shopForProfile = null;
        loadFit();
      });
      // Inject a "Continue with Styla" button at the top of the guest form.
      function ensureConnectBtn() {
        if (!formPanel || formPanel.querySelector('.styla-connect-wrap')) return;
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
      async function renderShopFor() {
        if (!getToken()) return;
        var host = detailsBody; if (!host) return;
        var existing = host.querySelector('.styla-shopfor'); if (existing) return;
        try {
          var d = await conn('list'); var people = d.sharedWithMe || [];
          if (!people.length) return;
          STATE.people = people;
          var box = document.createElement('div'); box.className = 'styla-shopfor';
          box.innerHTML = '<span class="styla-shopfor-lbl">🛍️ Shopping for</span>' +
            '<select class="styla-shopfor-sel"><option value="me">Me</option>' +
            people.map(function (p) { return '<option value="' + p.owner_id + '">' + (p.owner_email || 'Someone') + (p.relationship ? ' · ' + p.relationship : '') + '</option>'; }).join('') + '</select>';
          host.insertBefore(box, host.firstChild);
          box.querySelector('.styla-shopfor-sel').value = STATE.shopForId || 'me';
          box.querySelector('.styla-shopfor-sel').addEventListener('change', async function () {
            var v = this.value;
            STATE.shopForId = (v === 'me') ? null : v;
            if (!STATE.shopForId) { STATE.shopForProfile = null; }
            else {
              var pr = (await conn('get-profile', { ownerId: v })).profile || {};
              STATE.shopForProfile = { chest: pr.chest, waist: pr.waist, belly: pr.belly || pr.waist, hips: pr.hips, shoulder: pr.shoulder, height: pr.height, inseam: pr.inseam };
            }
            STATE.result = null; loadFit();
          });
        } catch (e) {}
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
        if (cands.length < 2) { if (discSizes) discSizes.classList.add('styla-hidden'); return; }
        if (discSizes) discSizes.classList.remove('styla-hidden');
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
        if (!opts.length) { discLen.classList.add('styla-hidden'); return; }
        discLen.classList.remove('styla-hidden');
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
        if (!rows || !rows.length) { discChart.classList.add('styla-hidden'); return; }
        discChart.classList.remove('styla-hidden');
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
        if (confEl) confEl.textContent = (res.score != null ? res.score + '% match' : '');

        var rl = res.recommendedLength;
        if (lenBadgeEl) lenBadgeEl.textContent = (rl && rl.name) ? 'Suggested length: ' + rl.name : '';

        var bk = c.breakdown || {};
        var keys = Object.keys(bk);
        listEl.innerHTML = keys.length ? keys.map(function (k) {
          var txt = bk[k];
          return '<li><span class="styla-fit-dim">' + dimLabel(k) + '</span>' +
            '<span class="styla-fit-note">' + esc(txt) + '</span>' +
            '<span class="styla-fit-tag ' + statusFor(txt) + '">' + badgeFor(txt) + '</span></li>';
        }).join('') : '<li><span class="styla-fit-note">This brand\'s chart doesn\'t share a measurement we can compare.</span></li>';

        var st = res.stock, stockTxt = '';
        if (st) { var sk = Object.keys(st).find(function (x) { return x.toLowerCase() === String(sizeName).trim().toLowerCase(); });
                  if (sk) stockTxt = st[sk] ? 'In stock.' : 'Sold out in this size.'; }
        var verb = (sizeName === res.size)
          ? 'Your best fit — ' + cap(c.spectrum || res.spectrum) + '.'
          : (c.fits ? cap(c.spectrum) + ' on you' : 'Not recommended') + ' vs. your best size ' + res.size + '.';
        if (intentCard && intentEl) {
          intentEl.textContent = [verb, stockTxt].filter(Boolean).join(' ');
          intentCard.classList.remove('styla-hidden');
        }
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
        // Both fallbacks used to point at an "AI Tailor tab" that no longer
        // exists — the chat is right below now, so just say so.
        if (intentCard) intentCard.classList.remove('styla-hidden');
        if (intentEl) intentEl.textContent = text;
      }
      function renderNoChart() {
        listEl.innerHTML = '';
        bestValEl.textContent = '—';
        if (confEl) confEl.textContent = '';
        [discSizes, discLen, discChart].forEach(function (d) { if (d) d.classList.add('styla-hidden'); });
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
      if (saveBtn) saveBtn.addEventListener('click', function () {
        var manual = el('styla-manual') && el('styla-manual').style.display !== 'none';
        var p = manual ? profileFromManual() : profileFromQuiz();
        if (!p) { var t = el('styla-form-title'); if (t) t.textContent = 'Chest, waist and height are needed — height decides Short/Regular/Long.'; return; }
        setProfile(p);
        hideForm();
        STATE.result = null; loadFit();
      });

      // ---------- AI Tailor chat (streamed) ----------
      var chatHistory = el('styla-chat-history'), chatInput = el('styla-chat-input'), chatSend = el('styla-chat-send');
      var CHAT = [];
      function bubble(cls) {
        var b = document.createElement('div'); b.className = 'chat-msg ' + cls;
        var p = document.createElement('p'); b.appendChild(p);
        chatHistory.appendChild(b); chatHistory.scrollTop = chatHistory.scrollHeight; return p;
      }
      async function sendChat() {
        var q = (chatInput.value || '').trim(); if (!q || STATE.chatBusy) return;
        chatInput.value = '';
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
