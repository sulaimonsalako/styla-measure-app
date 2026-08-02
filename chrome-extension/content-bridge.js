/* Styla identity bridge — runs on EVERY site.
 * Lets a Styla widget iframe (styla.ca) ask the extension for the shopper's
 * signed-in session + measurements, so they stay recognized on every store
 * without a per-site login. The iframe posts {type:'styla-request-identity'};
 * we reply to that iframe with {type:'styla-identity', session, measurements}.
 */
(function () {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.type !== 'styla-request-identity') return;
    try {
      chrome.runtime.sendMessage({ type: 'STYLA_GET_IDENTITY' }, function (resp) {
        var err = chrome.runtime.lastError; if (err) return;
        var target = ev.source;
        if (target && target.postMessage) {
          target.postMessage({ type: 'styla-identity', session: (resp && resp.session) || null, measurements: (resp && resp.measurements) || null }, '*');
        }
      });
    } catch (e) {}
  });

  // Announce availability so a widget can prefer the extension path when present.
  try { window.postMessage({ type: 'styla-extension-present' }, '*'); } catch (e) {}
})();
