(function() {
  const currentScriptUrl = document.currentScript ? document.currentScript.src : '';
  let STYLA_HOST = 'https://www.styla.ca'; // default fallback
  if (currentScriptUrl) {
    try {
      const urlObj = new URL(currentScriptUrl);
      STYLA_HOST = urlObj.origin;
    } catch (e) {
      console.warn("Failed to parse currentScript src:", e);
    }
  } else if (window.location.origin.includes('localhost')) {
    STYLA_HOST = 'http://localhost:3000';
  }
  
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

  let dataSent = false;
  const sendScrapedData = () => {
    if (dataSent) return;
    dataSent = true;
    iframe.contentWindow.postMessage({
      type: 'STYLA_SCRAPE_RESULT',
      pageTitle,
      pageText,
      tableHtml,
      url
    }, '*');
  };

  // Listen for messages from iframe (Register listener BEFORE appending iframe to DOM)
  const messageListener = (event) => {
    if (event.data) {
      if (event.data.type === 'STYLA_WIDGET_CLOSE') {
        container.remove();
        window.removeEventListener('message', messageListener);
      } else if (event.data.type === 'STYLA_WIDGET_READY') {
        sendScrapedData();
      } else if (event.data.type === 'STYLA_GET_STORAGE') {
        const result = {};
        if (event.data.keys && Array.isArray(event.data.keys)) {
          event.data.keys.forEach(k => {
            try {
              result[k] = window.localStorage.getItem(k);
            } catch (e) {}
          });
        }
        iframe.contentWindow.postMessage({
          type: 'STYLA_STORAGE_DATA',
          data: result
        }, '*');
      } else if (event.data.type === 'STYLA_SET_STORAGE') {
        try {
          window.localStorage.setItem(event.data.key, event.data.value);
        } catch (e) {}
      } else if (event.data.type === 'STYLA_REMOVE_STORAGE') {
        try {
          window.localStorage.removeItem(event.data.key);
        } catch (e) {}
      }
    }
  };
  window.addEventListener('message', messageListener);

  // Append iframe to DOM (Starts iframe loading)
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Fallback onload event
  iframe.onload = () => {
    setTimeout(sendScrapedData, 100);
  };
})();

