// This script runs in the context of the active tab to extract product specs and sizing tables.
(async () => {
  // Helper to find clickable size guide trigger elements
  function findSizeChartButton() {
    const keywords = [/size\s*guide/i, /size\s*chart/i, /sizing\s*guide/i, /sizing\s*info/i, /find\s*your\s*size/i];
    const elements = Array.from(document.querySelectorAll('button, a, span, div, li'));
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
    const elements = Array.from(document.querySelectorAll('button, a, span, div'));
    
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

    // 3. Extract HTML Sizing Tables
    let tableHtml = "";
    const tables = document.querySelectorAll('table');
    const sizeKeywords = ['size', 'chest', 'waist', 'hips', 'bust', 'inches', 'cm', 'sizing', 'fit', 'guide', 'chart'];
    
    for (const table of tables) {
      const html = table.outerHTML;
      const text = table.innerText.toLowerCase();
      const matches = sizeKeywords.filter(keyword => text.includes(keyword));
      if (matches.length >= 2) {
        tableHtml += html + "\n\n";
      }
    }

    // 4. Extract Images with Dimensions and Sorting by Visual Area
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

    const allImages = Array.from(document.querySelectorAll('img'));
    for (const img of allImages) {
      let src = '';
      
      const lazyAttributes = ['data-src', 'data-lazy-src', 'data-original', 'data-actual-src', 'data-lazyload-src'];
      for (const attr of lazyAttributes) {
        const val = img.getAttribute(attr);
        if (val) {
          const trimmedVal = val.trim();
          if (trimmedVal.startsWith('http')) {
            src = trimmedVal;
            break;
          } else if (trimmedVal.startsWith('//')) {
            src = 'https:' + trimmedVal;
            break;
          }
        }
      }
      
      if (!src) {
        const standardSrc = img.src || img.getAttribute('src');
        if (standardSrc) {
          const trimmedSrc = standardSrc.trim();
          const isPlaceholder = trimmedSrc.startsWith('data:image') || 
                                trimmedSrc.includes('placeholder') || 
                                trimmedSrc.includes('blank.gif') || 
                                trimmedSrc.includes('spacer.gif');
                                
          if (!isPlaceholder) {
            if (trimmedSrc.startsWith('http')) {
              src = trimmedSrc;
            } else if (trimmedSrc.startsWith('//')) {
              src = 'https:' + trimmedSrc;
            }
          }
        }
      }

      if (!src) continue;

      const srcLower = src.toLowerCase();
      if (srcLower.includes('logo') || srcLower.includes('icon') || srcLower.includes('banner') || srcLower.includes('avatar') || srcLower.includes('theme') || srcLower.includes('button')) {
        continue;
      }

      const width = img.naturalWidth || img.clientWidth || 0;
      const height = img.naturalHeight || img.clientHeight || 0;
      const area = width * height;

      // Exclude very small images/thumbnails (anything under 180px width or height unless size-chart is explicitly in name)
      const alt = (img.alt || '').toLowerCase();
      const isLikelySizeChart = alt.includes('size') || alt.includes('chart') || alt.includes('measure') || alt.includes('guide') ||
                                srcLower.includes('size') || srcLower.includes('chart') || srcLower.includes('measure') || srcLower.includes('guide');

      if (isLikelySizeChart || width > 180 || height > 180 || area > 35000 || !width) {
        candidateImages.push({
          src,
          width,
          height,
          area: area || 100000, // Default to a standard size area if not yet fully loaded
          isLikelySizeChart
        });
      }
    }

    // Sort candidate images:
    // 1. Sizing charts first (keyword matches)
    // 2. Then by visual size (largest image area first)
    candidateImages.sort((a, b) => {
      if (a.isLikelySizeChart && !b.isLikelySizeChart) return -1;
      if (!a.isLikelySizeChart && b.isLikelySizeChart) return 1;
      return b.area - a.area;
    });

    // Extract top 8 unique image URLs
    const finalImageUrls = [];
    for (const item of candidateImages) {
      if (!finalImageUrls.includes(item.src)) {
        finalImageUrls.push(item.src);
      }
      if (finalImageUrls.length >= 8) break;
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

  // 3. Fallback: If missing, attempt button clicking
  if (!hasHtmlTable && !hasChartImage) {
    const sizeBtn = findSizeChartButton();
    if (sizeBtn) {
      console.log("Styla found size chart button/modal trigger. Simulating click...");
      try {
        sizeBtn.click();
        
        // Wait 800ms for overlay rendering animation
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Rescrape the newly injected DOM elements
        const updatedData = scrapePage();
        
        // Dismiss the modal
        clickCloseButton();
        
        return updatedData;
      } catch (err) {
        console.error("Styla automatic click-scrape failed:", err);
      }
    }
  }

  return data;
})();
