/*
 * Styla bookmarklet loader.
 * Injected on ANY retail site by the user's bookmarklet. Opens the Styla size
 * finder (the same modern widget used for brand installs) in an overlay,
 * resolving the store's brand from its domain. The shopper logs in once — the
 * session persists (styla.ca origin) so subsequent sites recognize them and
 * show their size instantly, with the AI fit chat included.
 */
(function () {
  var ORIGIN = 'https://www.styla.ca';
  var existing = document.getElementById('styla-bm-overlay');
  if (existing) { existing.style.display = 'flex'; return; }

  var overlay = document.createElement('div');
  overlay.id = 'styla-bm-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.6)',
    'z-index:2147483000', 'display:flex', 'align-items:center',
    'justify-content:center', 'padding:16px'
  ].join(';');

  var iframe = document.createElement('iframe');
  iframe.src = ORIGIN + '/widget.html'
    + '?domain=' + encodeURIComponent(location.hostname)
    + '&product=' + encodeURIComponent(location.href)
    + '&bookmarklet=1';
  iframe.title = 'Styla size finder';
  iframe.style.cssText = [
    'width:100%', 'max-width:440px', 'height:660px', 'max-height:92vh',
    'border:none', 'border-radius:18px', 'box-shadow:0 30px 80px rgba(0,0,0,0.5)'
  ].join(';');

  overlay.appendChild(iframe);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.style.display = 'none'; });
  document.body.appendChild(overlay);
  window.addEventListener('message', function (ev) {
    if (ev.origin === ORIGIN && ev.data === 'styla-close') overlay.style.display = 'none';
  });
})();
