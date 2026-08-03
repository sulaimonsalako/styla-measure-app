/*
 * Styla universal fit-widget embed — works on ANY platform (WooCommerce,
 * BigCommerce, Wix, Squarespace, custom sites). Shopify has a native theme
 * app extension; this snippet covers everything else.
 *
 * Add to a product page:
 *   <div id="styla-fit"
 *        data-domain="yourstore.com"
 *        data-brand="Your Store"
 *        data-category="dresses"            (optional; helps pick the right chart)
 *        data-gender="women"                (optional: women|men|unisex)
 *        data-product-title="Linen Midi Dress"
 *        data-product-url="https://yourstore.com/products/linen-midi"
 *        data-product-desc="Breathable linen, relaxed fit, 100% linen..."
 *        data-button-text="Find my size"></div>
 *   <script src="https://www.styla.ca/embed.js" async></script>
 *
 * You can place multiple containers; each becomes its own button. The widget
 * itself is served from styla.ca (first-party), so shoppers stay signed in and
 * the AI can recommend across your whole catalog (once you've synced it).
 */
(function () {
  var ORIGIN = 'https://www.styla.ca';

  function mount(host) {
    if (host.getAttribute('data-styla-mounted')) return;
    host.setAttribute('data-styla-mounted', '1');
    var d = host.dataset || {};
    var domain = d.domain || location.hostname;
    var category = d.category || d.productType || '';
    var brand = d.brand || '';
    var product = d.productUrl || location.href;
    var gender = d.gender || 'women';
    // Product context for page-aware chat (fabric/care/fit questions).
    var ctx = { pageTitle: d.productTitle || document.title || '', pageText: d.productDesc || '', tableHtml: '', url: product };

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'styla-embed-btn';
    btn.textContent = d.buttonText || 'Find my size';
    btn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;cursor:pointer;font-weight:700;font-size:15px;line-height:1;border-radius:100px;padding:13px 22px;color:#fff;background:linear-gradient(135deg,#e11d48,#ff2a75);font-family:inherit;';
    host.appendChild(btn);

    var overlay = null, iframe = null, wired = false;
    function open() {
      if (overlay) { overlay.style.display = 'flex'; return; }
      overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;';
      iframe = document.createElement('iframe');
      var qs = 'domain=' + encodeURIComponent(domain) +
        '&category=' + encodeURIComponent(category) +
        '&brand=' + encodeURIComponent(brand) +
        '&product=' + encodeURIComponent(product) +
        '&gender=' + encodeURIComponent(gender);
      iframe.src = ORIGIN + '/widget.html?' + qs;
      iframe.title = 'Styla size finder';
      iframe.style.cssText = 'width:100%;max-width:440px;height:660px;max-height:92vh;border:none;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.5);background:#0b0b14;';
      overlay.appendChild(iframe);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.style.display = 'none'; });
      document.body.appendChild(overlay);

      if (!wired) {
        wired = true;
        window.addEventListener('message', function (ev) {
          if (ev.origin !== ORIGIN) return;
          // When the widget boots it asks for identity — reply with product context.
          if (ev.data === 'styla-ready' || (ev.data && ev.data.type === 'styla-request-identity')) {
            try { iframe.contentWindow.postMessage({ type: 'styla-context', page: ctx }, ORIGIN); } catch (e) {}
          }
          if (ev.data === 'styla-close') { if (overlay) overlay.style.display = 'none'; }
        });
      }
    }
    btn.addEventListener('click', open);
  }

  function init() {
    var hosts = [].slice.call(document.querySelectorAll('#styla-fit,[data-styla-fit],.styla-fit-embed'));
    hosts.forEach(mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
