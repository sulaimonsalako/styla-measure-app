/*
 * Styla bookmarklet loader.
 * Injected on ANY retail product page. Reads the size chart + product info that
 * are printed ON the page, then opens the Styla size finder (the modern widget)
 * which matches the shopper's body to that chart — returning their size, or
 * telling them their size isn't in the chart. Works on any site, onboarded or not.
 * The shopper logs in / answers once; the session persists (styla.ca origin) so
 * later pages recognize them instantly. Includes the AI fit chat.
 */
(function () {
  var ORIGIN = 'https://www.styla.ca';
  var existing = document.getElementById('styla-bm-overlay');
  if (existing) { existing.style.display = 'flex'; return; }

  // Scrape what's on THIS page: visible text, every table's HTML, title, url —
  // PLUS hidden size-guide content (modals are display:none, so innerText misses
  // them; textContent still reads them).
  function scrape() {
    var text = '';
    try { text = (document.body.innerText || '').replace(/\s+\n/g, '\n').slice(0, 20000); } catch (e) {}
    var tables = '';
    try {
      var ts = document.querySelectorAll('table');
      for (var i = 0; i < ts.length && tables.length < 40000; i++) { tables += ts[i].outerHTML; }
    } catch (e) {}
    var hidden = '';
    try {
      var els = document.querySelectorAll('[class*="size" i],[id*="size" i],[class*="chart" i],[id*="chart" i],[class*="guide" i],[class*="fit" i]');
      var seen = [];
      for (var j = 0; j < els.length && hidden.length < 18000; j++) {
        var t = (els[j].textContent || '').replace(/\s+/g, ' ').trim();
        if (t.length > 100 && t.length < 8000 && /\d{2}/.test(t) && seen.indexOf(t.slice(0, 80)) < 0) {
          seen.push(t.slice(0, 80));
          hidden += '\n---\n' + t;
        }
      }
    } catch (e) {}
    return {
      pageTitle: (document.title || '').slice(0, 300),
      pageText: text + (hidden ? '\n\n[HIDDEN SIZE-GUIDE CONTENT]\n' + hidden : ''),
      tableHtml: tables,
      url: location.href
    };
  }
  var pageData = scrape();
  // Personalized bookmarklet: the dashboard embeds the user's fit profile on the
  // script tag (base64url) so no login is needed inside the store-site iframe.
  try {
    var pd = document.currentScript && document.currentScript.getAttribute('data-styla-p');
    if (pd) pageData.profile_b64 = pd;
  } catch (e) {}

  var overlay = document.createElement('div');
  overlay.id = 'styla-bm-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.6)',
    'z-index:2147483000', 'display:flex', 'align-items:center',
    'justify-content:center', 'padding:16px'
  ].join(';');

  var iframe = document.createElement('iframe');
  iframe.src = ORIGIN + '/widget.html?bookmarklet=1&decode=1&domain=' + encodeURIComponent(location.hostname);
  iframe.title = 'Styla size finder';
  iframe.style.cssText = [
    'width:100%', 'max-width:440px', 'height:660px', 'max-height:92vh',
    'border:none', 'border-radius:18px', 'box-shadow:0 30px 80px rgba(0,0,0,0.5)'
  ].join(';');

  overlay.appendChild(iframe);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.style.display = 'none'; });
  document.body.appendChild(overlay);

  // Handshake: when the widget says it's ready, send it the scraped page.
  // On 'styla-rescrape' (user opened the size-guide modal), scrape AGAIN so the
  // now-visible chart is captured, and send the fresh page.
  window.addEventListener('message', function (ev) {
    if (ev.origin !== ORIGIN) return;
    if (ev.data === 'styla-ready') {
      try { iframe.contentWindow.postMessage({ type: 'styla-page', page: pageData }, ORIGIN); } catch (e) {}
    } else if (ev.data === 'styla-rescrape') {
      try {
        var fresh = scrape();
        if (pageData.profile_b64) fresh.profile_b64 = pageData.profile_b64;
        pageData = fresh;
        iframe.contentWindow.postMessage({ type: 'styla-page', page: fresh }, ORIGIN);
      } catch (e) {}
    } else if (ev.data === 'styla-close') {
      overlay.style.display = 'none';
    }
  });
})();
