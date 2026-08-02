/* Styla Fit Advisor — storefront widget.
 * Talks to the real Styla engine at styla.ca (CORS-enabled):
 *   POST /api/widget-size      -> recommended size + every size's fit, from the brand's chart
 *   POST /api/extension-chat   -> page-aware AI tailor (streamed for speed)
 * Guests answer a few measurements once (kept in localStorage); logged-in Styla
 * users get their saved profile. No hardcoded sizing.
 */
(function () {
  var API = 'https://www.styla.ca';
  var LS_PROFILE = 'styla_widget_profile';
  var LS_TOKEN = 'styla_widget_token';

  function getProfile() { try { return JSON.parse(localStorage.getItem(LS_PROFILE) || 'null'); } catch (e) { return null; } }
  function setProfile(p) { try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch (e) {} }
  function getToken() { try { return localStorage.getItem(LS_TOKEN) || null; } catch (e) { return null; } }

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

      var STATE = { result: null, activeSize: null, loading: false, chatBusy: false };

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
        var profile = getProfile(), token = getToken();
        if (!profile && !token) { showForm(true); return; }
        setLoading(true);
        try {
          var body = { domain: product.domain, productUrl: product.url, category: mapType(product.type) };
          if (token) body.accessToken = token; else body.profile = profile;
          var r = await fetch(API + '/api/widget-size', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
          var data = await r.json();
          if (!data || !data.size) { renderNoChart(); return; }
          STATE.result = data;
          STATE.activeSize = data.size;
          renderFit();
        } catch (e) { renderError(); } finally { setLoading(false); }
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
        intentEl.textContent = verb + (c.fits ? '' : ' This size compromises fit somewhere.');
        sliderRow.querySelectorAll('.styla-size-opt-btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-size') === sizeName);
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
      function showForm(first) { formPanel.classList.remove('styla-hidden'); detailsBody.classList.add('styla-hidden'); if (first) intentEl.textContent = ''; }
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
          sizeChart: STATE.result ? { sizes: (STATE.result.candidates || []) } : null,
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
