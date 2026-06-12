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

  // 2. Extract Description Text (targeting description wrappers or fallback to main content)
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
    // Fallback: get body text but clean it up
    pageText = document.body.innerText;
  }

  // Clean whitespace and truncate to prevent massive payload sizes
  pageText = pageText.replace(/\s+/g, ' ').trim().substring(0, 6000);

  // 3. Extract HTML Sizing Tables
  let tableHtml = "";
  const tables = document.querySelectorAll('table');
  const sizeKeywords = ['size', 'chest', 'waist', 'hips', 'bust', 'inches', 'cm', 'sizing', 'fit', 'guide', 'chart'];
  
  for (const table of tables) {
    const html = table.outerHTML;
    const text = table.innerText.toLowerCase();
    
    // Check if the table contains at least two size chart keywords
    const matches = sizeKeywords.filter(keyword => text.includes(keyword));
    if (matches.length >= 2) {
      tableHtml += html + "\n\n";
    }
  }

  // 4. Extract Product / Model Images
  const imageUrls = [];
  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg && ogImg.content && ogImg.content.startsWith('http')) {
    imageUrls.push(ogImg.content);
  }

  const images = Array.from(document.querySelectorAll('img'));
  for (const img of images) {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
    if (src && src.startsWith('http')) {
      const isLikelyProductImage = img.naturalWidth > 150 || img.naturalHeight > 150 || 
                                   (!img.naturalWidth && !src.includes('logo') && !src.includes('icon') && !src.includes('banner'));
      if (isLikelyProductImage && !imageUrls.includes(src)) {
        imageUrls.push(src);
      }
    }
    if (imageUrls.length >= 6) break; // Fetch up to 6 high-quality image candidates
  }

  return {
    pageTitle,
    pageText,
    tableHtml,
    imageUrls
  };
})();
