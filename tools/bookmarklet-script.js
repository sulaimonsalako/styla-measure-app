(function() {
  const STYLA_HOST = window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://styla-measure-app.vercel.app';
  
  // Prevent duplicate overlays
  const existing = document.getElementById('styla-bookmarklet-container');
  if (existing) {
    existing.remove();
    return;
  }

  // 1. Scrape data
  const pageTitle = document.title || document.querySelector('h1')?.innerText || 'Product Page';
  const url = window.location.href;

  // Extract description text
  let pageText = '';
  const descEl = document.querySelector('.product-description, #description, [class*="description"], [id*="description"]');
  if (descEl) pageText = descEl.innerText;
  else pageText = document.body.innerText.substring(0, 3000);

  // Extract tables containing sizing info
  let tableHtml = '';
  const tables = Array.from(document.querySelectorAll('table'));
  const sizeTables = tables.filter(t => /size|chart|measure|guide|fit/i.test(t.innerText));
  if (sizeTables.length > 0) {
    tableHtml = sizeTables[0].outerHTML;
  }

  // Create UI overlay container
  const container = document.createElement('div');
  container.id = 'styla-bookmarklet-container';
  
  // Set floating styles (mobile bottom sheet)
  const isMobile = window.innerWidth <= 480;
  const style = container.style;
  style.position = 'fixed';
  style.zIndex = '2147483647';
  style.background = '#07070f';
  style.boxShadow = '0 12px 40px rgba(0,0,0,0.5)';
  style.border = '1px solid rgba(255,255,255,0.1)';
  style.overflow = 'hidden';
  style.transition = 'all 0.3s ease-out';
  
  if (isMobile) {
    style.bottom = '0';
    style.left = '0';
    style.width = '100vw';
    style.height = '75vh';
    style.borderRadius = '20px 20px 0 0';
  } else {
    style.bottom = '20px';
    style.right = '20px';
    style.width = '380px';
    style.height = '620px';
    style.borderRadius = '20px';
  }

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = `${STYLA_HOST}/bookmarklet.html`;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = 'transparent';

  container.appendChild(iframe);
  document.body.appendChild(container);

  // Listen for close message
  const closeListener = (event) => {
    if (event.data && event.data.type === 'STYLA_WIDGET_CLOSE') {
      container.remove();
      window.removeEventListener('message', closeListener);
    }
  };
  window.addEventListener('message', closeListener);

  // Send scraped data when iframe loads
  iframe.onload = () => {
    iframe.contentWindow.postMessage({
      type: 'STYLA_SCRAPE_RESULT',
      pageTitle,
      pageText,
      tableHtml,
      url
    }, '*');
  };
})();

