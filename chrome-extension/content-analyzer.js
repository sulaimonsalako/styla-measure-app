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
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
    if (!src || !src.startsWith('http')) continue;

    // Filter out social icons, banners, logs
    const srcLower = src.toLowerCase();
    if (srcLower.includes('logo') || srcLower.includes('icon') || srcLower.includes('banner') || srcLower.includes('avatar') || srcLower.includes('theme')) {
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

  // Combine images prioritizing size charts, then carousel shots, then description graphics
  const finalImageUrls = [];
  
  // Add chart matches first
  descImages.forEach(url => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('size') || urlLower.includes('chart') || urlLower.includes('measure') || urlLower.includes('guide')) {
      if (finalImageUrls.length < 3) finalImageUrls.push(url);
    }
  });

  // Add top carousel model images
  mainImages.forEach(url => {
    if (finalImageUrls.length < 4 && !finalImageUrls.includes(url)) {
      finalImageUrls.push(url);
    }
  });

  // Add detail images (which often contain the actual size chart)
  descImages.forEach(url => {
    if (finalImageUrls.length < 6 && !finalImageUrls.includes(url)) {
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
