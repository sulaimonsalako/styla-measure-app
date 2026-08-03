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
      var sliderRow = modal.querySelector('.styla-size-options-list');
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

      // ---------- tabs ----------
      modal.querySelectorAll('.styla-tab-btn').forEach(function (tab) {
        tab.addEventListener('click', function () {
          modal.querySelectorAll('.styla-tab-btn').forEach(function (t) { t.classList.remove('active'); });
          modal.querySelectorAll('.styla-tab-content').forEach(function (c) { c.classList.remove('active'); });
          tab.classList.add('active');
          document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
        });
      });

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
        var res = STATE.result;
        var cands = res.candidates || [{ name: res.size, spectrum: res.spectrum, breakdown: res.breakdown, fits: res.fits }];
        sliderRow.innerHTML = cands.map(function (c) {
          return '<button type="button" class="styla-size-opt-btn' + (c.name === STATE.activeSize ? ' active' : '') +
            '" data-size="' + c.name + '">' + c.name + '</button>';
        }).join('');
        sliderRow.querySelectorAll('.styla-size-opt-btn').forEach(function (b) {
          b.addEventListener('click', function () { STATE.activeSize = b.getAttribute('data-size'); renderSize(STATE.activeSize); });
        });
        renderSize(STATE.activeSize);
      }
      function renderSize(sizeName) {
        var res = STATE.result;
        var cands = res.candidates || [];
        var c = cands.find(function (x) { return x.name === sizeName; }) ||
                { name: sizeName, spectrum: res.spectrum, breakdown: res.breakdown, fits: res.fits };
        bestValEl.textContent = res.size + (sizeName !== res.size ? ' → ' + sizeName : '');
        var bk = c.breakdown || {};
        var keys = Object.keys(bk);
        listEl.innerHTML = keys.length ? keys.map(function (k) {
          var txt = bk[k];
          return '<li class="styla-text-fit-item"><span class="styla-item-label">' + cap(k) +
            '</span><span class="styla-item-badge ' + statusFor(txt) + '">' + badgeFor(txt) +
            '</span><span class="styla-item-ease">' + txt + '</span></li>';
        }).join('') : '<li class="styla-text-fit-item"><span class="styla-item-ease">No overlapping measurements to compare on this chart.</span></li>';
        var verb = (sizeName === res.size)
          ? 'Your best fit — ' + cap(c.spectrum || res.spectrum) + '.'
          : (c.fits ? cap(c.spectrum) + ' on you' : 'Not recommended') + ' vs. your best size ' + res.size + '.';
        var rl = STATE.result.recommendedLength;
        var lenTxt = (rl && rl.name) ? ' · Suggested length: ' + rl.name : '';
        intentEl.textContent = verb + (c.fits ? '' : ' This size compromises fit somewhere.') + lenTxt;
        sliderRow.querySelectorAll('.styla-size-opt-btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-size') === sizeName);
        });
        maybeShowSave();
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
      function renderNoChart() {
        listEl.innerHTML = '';
        intentEl.textContent = 'We don’t have this brand’s size chart yet, so we can’t compute your size here. Try the AI Tailor tab.';
        bestValEl.textContent = '—';
      }
      function renderError() { intentEl.textContent = 'Something went wrong reaching Styla. Please try again in a moment.'; }
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
      if (saveBtn) saveBtn.addEventListener('click', function () {
        var chest = parseFloat((el('styla-in-chest') || {}).value);
        var waist = parseFloat((el('styla-in-waist') || {}).value);
        var shoulder = parseFloat((el('styla-in-shoulders') || {}).value);
        if (!chest || !waist) return;
        setProfile({ chest: chest, waist: waist, belly: waist, hips: waist + 4, shoulder: shoulder || undefined });
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
          history: CHAT
        };
        if (token) payload.accessToken = token;
        else if (profile) { payload.chest = profile.chest; payload.waist = profile.waist; payload.belly = profile.belly || profile.waist; payload.hips = profile.hips; payload.shoulder = profile.shoulder; }
        else { payload.chest = 38; payload.waist = 31; payload.belly = 31; payload.hips = 40; }
        try {
          var r = await fetch(API + '/api/extension-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (r.body && r.body.getReader) {
            var reader = r.body.getReader(), decr = new TextDecoder(), acc = '';
            out.textContent = '';
            while (true) {
              var chunk = await reader.read();
              if (chunk.done) break;
              acc += decr.decode(chunk.value, { stream: true });
              out.textContent = acc;
              chatHistory.scrollTop = chatHistory.scrollHeight;
            }
            CHAT.push({ role: 'model', text: acc });
          } else {
            var data = await r.json(); var reply = (data && (data.reply || data.error)) || '…';
            out.textContent = reply; CHAT.push({ role: 'model', text: reply });
          }
        } catch (e) { out.textContent = 'Sorry — I couldn’t answer just now. Try again?'; }
        STATE.chatBusy = false;
      }
      if (chatSend) chatSend.addEventListener('click', sendChat);
      if (chatInput) chatInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') sendChat(); });
    });
  });
})();
