// This script runs in the context of the active tab to extract product specs and sizing tables.
(() => {
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

  // Clean whitespace and truncate
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

  // 4. Extract Product / Model Images (Split into Carousel and Details/Charts)
  const mainImages = [];
  const descImages = [];

  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg && ogImg.content && ogImg.content.startsWith('http')) {
    mainImages.push(ogImg.content);
  }

  const allImages = Array.from(document.querySelectorAll('img'));
  for (const img of allImages) {
    let src = '';
    
    // Check lazy-loading attributes first
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
    
    // Fallback to standard src if no lazy attribute found
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

    // Filter out common UI elements
    const srcLower = src.toLowerCase();
    if (srcLower.includes('logo') || srcLower.includes('icon') || srcLower.includes('banner') || srcLower.includes('avatar') || srcLower.includes('theme') || srcLower.includes('button')) {
      continue;
    }

    const isLarge = img.naturalWidth > 150 || img.naturalHeight > 150 || !img.naturalWidth;
    if (!isLarge) continue;

    // Detect if this image lives in the product description area
    let isInsideDescription = false;
    if (contentArea && contentArea.contains(img)) {
      isInsideDescription = true;
    } else {
      let parent = img.parentElement;
      while (parent && parent !== document.body) {
        const className = (parent.className || '').toString().toLowerCase();
        const idName = (parent.id || '').toString().toLowerCase();
        if (className.includes('desc') || className.includes('detail') || className.includes('spec') || 
            idName.includes('desc') || idName.includes('detail') || idName.includes('spec')) {
          isInsideDescription = true;
          break;
        }
        parent = parent.parentElement;
      }
    }

    const alt = (img.alt || '').toLowerCase();
    const isLikelySizeChart = alt.includes('size') || alt.includes('chart') || alt.includes('measure') || alt.includes('guide') ||
                              srcLower.includes('size') || srcLower.includes('chart') || srcLower.includes('measure') || srcLower.includes('guide');

    if (isLikelySizeChart) {
      if (!descImages.includes(src)) descImages.unshift(src); // Prioritize size charts
    } else if (isInsideDescription) {
      if (!descImages.includes(src)) descImages.push(src);
    } else {
      if (!mainImages.includes(src)) mainImages.push(src);
    }
  }

  // Split description images into keyword matches vs others
  const keywordMatches = [];
  const otherDescImages = [];
  descImages.forEach(url => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('size') || urlLower.includes('chart') || urlLower.includes('measure') || urlLower.includes('guide')) {
      keywordMatches.push(url);
    } else {
      otherDescImages.push(url);
    }
  });

  const finalImageUrls = [];
  
  // 1. Add all keyword matches (up to 3)
  keywordMatches.forEach(url => {
    if (finalImageUrls.length < 3) finalImageUrls.push(url);
  });

  // 2. Add the LAST 2 images from the description (highly likely to contain the size chart at the bottom)
  if (otherDescImages.length > 0) {
    const lastImages = otherDescImages.slice(-2);
    lastImages.forEach(url => {
      if (finalImageUrls.length < 5 && !finalImageUrls.includes(url)) {
        finalImageUrls.push(url);
      }
    });
  }

  // 3. Add main product shots from the top carousel (up to 2)
  mainImages.forEach(url => {
    if (finalImageUrls.length < 7 && !finalImageUrls.includes(url)) {
      finalImageUrls.push(url);
    }
  });

  // 4. Add the first few description images (fallback details)
  otherDescImages.forEach(url => {
    if (finalImageUrls.length < 8 && !finalImageUrls.includes(url)) {
      finalImageUrls.push(url);
    }
  });

  return {
    pageTitle,
    pageText,
    tableHtml,
    imageUrls: finalImageUrls
  };
})();
