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

  // Scrape what's on THIS page: visible text, every table's HTML, title, url.
  function scrape() {
    var text = '';
    try { text = (document.body.innerText || '').replace(/\s+\n/g, '\n').slice(0, 22000); } catch (e) {}
    var tables = '';
    try {
      var ts = document.querySelectorAll('table');
      for (var i = 0; i < ts.length && tables.length < 45000; i++) { tables += ts[i].outerHTML; }
    } catch (e) {}
    return {
      pageTitle: (document.title || '').slice(0, 300),
      pageText: text,
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
  window.addEventListener('message', function (ev) {
    if (ev.origin !== ORIGIN) return;
    if (ev.data === 'styla-ready') {
      try { iframe.contentWindow.postMessage({ type: 'styla-page', page: pageData }, ORIGIN); } catch (e) {}
    } else if (ev.data === 'styla-close') {
      overlay.style.display = 'none';
    }
  });
})();
