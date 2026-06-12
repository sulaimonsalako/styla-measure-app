// This script runs in the context of the active tab to extract product specs and sizing tables.
(async () => {
  // Helper to find clickable size guide trigger elements
  function findSizeChartButton() {
    const keywords = [/size\s*guide/i, /size\s*chart/i, /sizing\s*guide/i, /sizing\s*info/i, /find\s*your\s*size/i];
    const elements = getAllElements(document);
    for (const el of elements) {
      const text = (el.innerText || el.textContent || '').trim();
      if (text.length > 0 && text.length < 50) {
        if (keywords.some(regex => regex.test(text))) {
          const isClickable = el.tagName === 'BUTTON' || 
                              el.tagName === 'A' || 
                              el.onclick || 
                              el.getAttribute('role') === 'button' || 
                              el.className.toLowerCase().includes('trigger') || 
                              el.className.toLowerCase().includes('btn') ||
                              el.className.toLowerCase().includes('size');
                              
          if (isClickable) {
            return el;
          }
        }
      }
    }
    return null;
  }

  // Helper to find and click the close button of a modal
  function clickCloseButton() {
    const closeKeywords = [/close/i, /dismiss/i, /hide/i, /cancel/i, /^x$/i];
    const elements = getAllElements(document);
    
    for (const el of elements) {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      const isClose = closeKeywords.some(regex => regex.test(text)) || 
                      el.getAttribute('aria-label') === 'Close' || 
                      el.className.toLowerCase().includes('close') ||
                      el.className.toLowerCase().includes('dismiss');
                      
      if (isClose && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button')) {
        try {
          el.click();
          console.log("Styla closed the size guide modal programmatically.");
          return true;
        } catch (err) {
          // Suppress errors during click attempt
        }
      }
    }
    return false;
  }

  // Recursive Shadow DOM Traverser for all elements
  function getAllElements(root = document) {
    const elements = [];
    function traverse(node) {
      if (!node) return;
      if (node.nodeType === Node.ELEMENT_NODE) {
        elements.push(node);
      }
      if (node.shadowRoot) {
        traverse(node.shadowRoot);
      }
      let child = node.firstElementChild;
      while (child) {
        traverse(child);
        child = child.nextElementSibling;
      }
    }
    traverse(root);
    return elements;
  }

  // Recursive Shadow DOM Traverser for images
  function getAllImages(root = document) {
    const images = [];
    function traverse(node) {
      if (!node) return;
      if (node.tagName === 'IMG') {
        images.push(node);
      }
      if (node.shadowRoot) {
        traverse(node.shadowRoot);
      }
      let child = node.firstElementChild;
      while (child) {
        traverse(child);
        child = child.nextElementSibling;
      }
    }
    traverse(root);
    return images;
  }

  // Recursive Shadow DOM Traverser for tables
  function getAllTables(root = document) {
    const tables = [];
    function traverse(node) {
      if (!node) return;
      if (node.tagName === 'TABLE') {
        tables.push(node);
      }
      if (node.shadowRoot) {
        traverse(node.shadowRoot);
      }
      let child = node.firstElementChild;
      while (child) {
        traverse(child);
        child = child.nextElementSibling;
      }
    }
    traverse(root);
    return tables;
  }

  // Core scraping function
  function scrapePage() {
    // 1. Extract Page Title
    let pageTitle = document.title;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      pageTitle = ogTitle.content;
    } else {
      const h1 = document.querySelector('h1');
      if (h1) pageTitle = h1.innerText.trim();
    }

    // 2. Extract Description Text
    let pageText = "";
    const descriptionSelectors = [
      '.product-description', '.product-details', '.description', 
      '#description', '#product-details', '[class*="description"]',
      '[class*="details"]', '[class*="specs"]', 'main', 'article'
    ];
    
    let contentArea = null;
    for (const selector of descriptionSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        contentArea = el;
        break;
      }
    }
    
    if (contentArea) {
      pageText = contentArea.innerText;
    } else {
      pageText = document.body.innerText;
    }
    pageText = pageText.replace(/\s+/g, ' ').trim().substring(0, 6000);

    // 3. Extract HTML Sizing Tables (using Shadow DOM search)
    let tableHtml = "";
    const tables = getAllTables(document);
    const sizeKeywords = ['size', 'chest', 'waist', 'hips', 'bust', 'inches', 'cm', 'sizing', 'fit', 'guide', 'chart'];
    
    for (const table of tables) {
      const html = table.outerHTML;
      const text = table.innerText.toLowerCase();
      const matches = sizeKeywords.filter(keyword => text.includes(keyword));
      if (matches.length >= 2) {
        tableHtml += html + "\n\n";
      }
    }

    // 4. Extract Images with Dimensions (using Shadow DOM search)
    const candidateImages = [];
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg && ogImg.content && ogImg.content.startsWith('http')) {
      candidateImages.push({
        src: ogImg.content.trim(),
        width: 800,
        height: 800,
        area: 640000,
        isLikelySizeChart: false
      });
    }

    const allImages = getAllImages(document);
    for (const img of allImages) {
      let src = '';
      let rawUrl = '';
      
      const lazyAttributes = [
        'data-src', 'data-lazy-src', 'data-original', 'data-actual-src', 
        'data-lazyload-src', 'data-origin-src', 'data-src-webp', 'data-hi-res'
      ];
      for (const attr of lazyAttributes) {
        const val = img.getAttribute(attr);
        if (val && val.trim()) {
          rawUrl = val.trim();
          break;
        }
      }
      
      if (!rawUrl) {
        const standardSrc = img.src || img.getAttribute('src');
        if (standardSrc) {
          const trimmedSrc = standardSrc.trim();
          const isPlaceholder = trimmedSrc.startsWith('data:image') || 
                                trimmedSrc.includes('placeholder') || 
                                trimmedSrc.includes('blank.gif') || 
                                trimmedSrc.includes('spacer.gif');
                                
          if (!isPlaceholder) {
            rawUrl = trimmedSrc;
          }
        }
      }

      if (!rawUrl) continue;

      try {
        src = new URL(rawUrl, document.baseURI).href;
      } catch (e) {
        if (rawUrl.startsWith('//')) {
          src = 'https:' + rawUrl;
        } else if (rawUrl.startsWith('http')) {
          src = rawUrl;
        } else {
          continue;
        }
      }

      const srcLower = src.toLowerCase();
      if (srcLower.includes('logo') || srcLower.includes('icon') || srcLower.includes('banner') || srcLower.includes('avatar') || srcLower.includes('theme') || srcLower.includes('button')) {
        continue;
      }

      const width = img.naturalWidth || img.clientWidth || 0;
      const height = img.naturalHeight || img.clientHeight || 0;
      const area = width * height;

      const alt = (img.alt || '').toLowerCase();
      
      // Check if image or its parents have sizing keywords in their class/id
      let parentHasKeyword = false;
      let current = img.parentElement;
      const classIdKeywords = ['size', 'chart', 'measure', 'guide', 'spec', 'dimension', 'table'];
      for (let i = 0; i < 4 && current; i++) {
        const className = (current.className || '').toString().toLowerCase();
        const idName = (current.id || '').toString().toLowerCase();
        if (classIdKeywords.some(kw => className.includes(kw) || idName.includes(kw))) {
          parentHasKeyword = true;
          break;
        }
        current = current.parentElement;
      }

      const isLikelySizeChart = alt.includes('size') || alt.includes('chart') || alt.includes('measure') || alt.includes('guide') ||
                                srcLower.includes('size') || srcLower.includes('chart') || srcLower.includes('measure') || srcLower.includes('guide') ||
                                parentHasKeyword;

      if (isLikelySizeChart || width > 180 || height > 180 || area > 35000 || !width) {
        candidateImages.push({
          src,
          width,
          height,
          area: area || 100000,
          isLikelySizeChart
        });
      }
    }

    // Sort candidate images descending by area, prioritizing size charts
    candidateImages.sort((a, b) => {
      if (a.isLikelySizeChart && !b.isLikelySizeChart) return -1;
      if (!a.isLikelySizeChart && b.isLikelySizeChart) return 1;
      return b.area - a.area;
    });

    const finalImageUrls = [];
    for (const item of candidateImages) {
      if (!finalImageUrls.includes(item.src)) {
        finalImageUrls.push(item.src);
      }
      if (finalImageUrls.length >= 15) break;
    }

    return {
      pageTitle,
      pageText,
      tableHtml,
      imageUrls: finalImageUrls
    };
  }

  // 1. Run initial page scrape
  let data = scrapePage();

  // 2. Determine if size chart is missing
  const hasHtmlTable = data.tableHtml.length > 0;
  const hasChartImage = data.imageUrls.some(url => 
    url.toLowerCase().includes('size') || 
    url.toLowerCase().includes('chart') || 
    url.toLowerCase().includes('measure') || 
    url.toLowerCase().includes('guide')
  );



  return data;
})();
