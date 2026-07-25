/*
 * Styla embeddable size widget.
 * Brands add one line to a product page:
 *   <script src="https://www.styla.ca/widget.js"
 *           data-styla-brand="Your Brand"
 *           data-styla-category="dresses"
 *           data-styla-gender="women" defer></script>
 * Optionally place <div id="styla-widget"></div> where the button should mount;
 * otherwise the button is inserted right after the script tag.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var ORIGIN = 'https://www.styla.ca';
  var brand = script.getAttribute('data-styla-brand') || '';
  var category = script.getAttribute('data-styla-category') || '';
  var gender = script.getAttribute('data-styla-gender') || '';
  var label = script.getAttribute('data-styla-label') || 'Find your size';

  function build() {
    // Button
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '📏 ' + label;
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.style.cssText = [
      'display:inline-flex', 'align-items:center', 'gap:8px', 'cursor:pointer',
      'font-family:inherit', 'font-weight:700', 'font-size:15px', 'color:#fff',
      'background:linear-gradient(135deg,#e11d48,#ff2a75)', 'border:none',
      'border-radius:100px', 'padding:12px 22px', 'box-shadow:0 4px 14px rgba(255,42,117,0.3)'
    ].join(';');

    var mount = document.getElementById('styla-widget');
    if (mount) mount.appendChild(btn);
    else if (script.parentNode) script.parentNode.insertBefore(btn, script.nextSibling);
    else document.body.appendChild(btn);

    // Overlay + iframe (lazy-created on first open)
    var overlay = null, iframe = null;
    function open() {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.style.cssText = [
          'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.6)',
          'z-index:2147483000', 'display:flex', 'align-items:center',
          'justify-content:center', 'padding:16px'
        ].join(';');
        iframe = document.createElement('iframe');
        var src = ORIGIN + '/widget.html?brand=' + encodeURIComponent(brand) +
          '&category=' + encodeURIComponent(category) +
          '&gender=' + encodeURIComponent(gender);
        iframe.src = src;
        iframe.setAttribute('title', 'Styla size finder');
        iframe.style.cssText = [
          'width:100%', 'max-width:440px', 'height:660px', 'max-height:92vh',
          'border:none', 'border-radius:18px', 'box-shadow:0 30px 80px rgba(0,0,0,0.5)'
        ].join(';');
        overlay.appendChild(iframe);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        document.body.appendChild(overlay);
      }
      overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    function close() {
      if (overlay) overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
    btn.addEventListener('click', open);
    window.addEventListener('message', function (ev) {
      if (ev.origin === ORIGIN && ev.data === 'styla-close') close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
