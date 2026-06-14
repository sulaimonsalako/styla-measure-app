// This script runs in the context of the active tab to extract product specs and sizing tables.
(async () => {
  // Helper to find clickable size guide trigger elements
  function findSizeChartButton() {
    const keywords = [
      /size\s*guide/i, 
      /size\s*chart/i, 
      /sizing\s*guide/i, 
      /sizing\s*info/i, 
      /find\s*your\s*size/i,
      /product\s*measurements/i,
      /measurements/i,
      /fit\s*guide/i,
      /size\s*help/i
    ];
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

  // Find custom grid sizing containers (divs, grids, etc.)
  function findSizingContainers(root = document) {
    const candidates = [];
    const elements = getAllElements(root);
    
    const sizeKeywords = ['chest', 'waist', 'hips', 'bust', 'shoulder', 'inseam', 'sleeve', 'underbust', 'back width', 'front length'];
    
    for (const el of elements) {
      if (el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'MAIN' || el.tagName === 'ARTICLE' || el.tagName === 'HEADER' || el.tagName === 'FOOTER') {
        continue;
      }
      
      const text = (el.innerText || '').toLowerCase();
      if (text.length > 4000) continue;
      
      const matchedMetrics = sizeKeywords.filter(kw => text.includes(kw));
      if (matchedMetrics.length >= 2) {
        const numbers = text.match(/\d+(\.\d+)?/g);
        const numCount = numbers ? numbers.length : 0;
        
        if (numCount >= 4) {
          const score = matchedMetrics.length * 10 + numCount;
          candidates.push({ element: el, score: score, textLength: text.length });
        }
      }
    }
    
    candidates.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.textLength - b.textLength;
    });
    
    return candidates.map(c => c.element);
  }

  // Reconstruct markdown table from any css grid / div layout using visual bounding rect coordinates of text nodes
  function reconstructGridFromContainer(container) {
    const elements = [];
    const containerRect = container.getBoundingClientRect();
    
    function collectTextNodes(node) {
      if (!node) return;
      
      // Check if element is visible
      if (node.nodeType === Node.ELEMENT_NODE) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return; // skip hidden elements
        }
        // If it's a hidden element by style, also skip
        try {
          const style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
            return;
          }
        } catch (e) {}
      }
      
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.trim();
        if (text) {
          try {
            const range = document.createRange();
            range.selectNodeContents(node);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              elements.push({
                text: text.replace(/\s+/g, ' '),
                top: rect.top - containerRect.top,
                left: rect.left - containerRect.left,
                bottom: rect.bottom - containerRect.top,
                right: rect.right - containerRect.left,
                height: rect.height,
                width: rect.width
              });
            }
          } catch (e) {
            // Fallback to parent element coordinates if range bounding rect fails
            const parent = node.parentElement;
            if (parent) {
              const rect = parent.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                elements.push({
                  text: text.replace(/\s+/g, ' '),
                  top: rect.top - containerRect.top,
                  left: rect.left - containerRect.left,
                  bottom: rect.bottom - containerRect.top,
                  right: rect.right - containerRect.left,
                  height: rect.height,
                  width: rect.width
                });
              }
            }
          }
        }
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          collectTextNodes(node.childNodes[i]);
        }
      }
    }
    
    collectTextNodes(container);
    
    if (elements.length === 0) return "";
    
    // Sort elements by top coordinate first. If same top (within 8px), sort by left.
    elements.sort((a, b) => {
      if (Math.abs(a.top - b.top) > 8) {
        return a.top - b.top;
      }
      return a.left - b.left;
    });
    
    // Merge elements on the same row that are very close horizontally (less than 15px gap)
    const mergedElements = [];
    for (const el of elements) {
      if (mergedElements.length === 0) {
        mergedElements.push(el);
      } else {
        const prev = mergedElements[mergedElements.length - 1];
        const isSameRow = Math.abs(el.top - prev.top) <= 8;
        const isHorizontalGapClose = (el.left - prev.right) < 15;
        
        if (isSameRow && isHorizontalGapClose) {
          const space = (el.left - prev.right) > 2 ? " " : "";
          prev.text = prev.text + space + el.text;
          prev.right = Math.max(prev.right, el.right);
          prev.width = prev.right - prev.left;
          prev.top = Math.min(prev.top, el.top);
          prev.bottom = Math.max(prev.bottom, el.bottom);
          prev.height = prev.bottom - prev.top;
        } else {
          mergedElements.push(el);
        }
      }
    }
    
    if (mergedElements.length === 0) return "";
    
    // Group merged elements into visual rows by top coordinate
    const rows = [];
    let currentRow = [];
    for (const el of mergedElements) {
      if (currentRow.length === 0) {
        currentRow.push(el);
      } else {
        const rowAnchor = currentRow[0];
        if (Math.abs(el.top - rowAnchor.top) <= 8) {
          currentRow.push(el);
        } else {
          currentRow.sort((a, b) => a.left - b.left);
          rows.push(currentRow);
          currentRow = [el];
        }
      }
    }
    if (currentRow.length > 0) {
      currentRow.sort((a, b) => a.left - b.left);
      rows.push(currentRow);
    }
    
    // Identify column clusters using left coordinates
    const colThreshold = 30; // pixels
    const colClusters = [];
    
    for (const el of mergedElements) {
      let found = false;
      for (const col of colClusters) {
        const colLeft = col.sum / col.count;
        if (Math.abs(el.left - colLeft) <= colThreshold) {
          col.sum += el.left;
          col.count++;
          found = true;
          break;
        }
      }
      if (!found) {
        colClusters.push({ sum: el.left, count: 1 });
      }
    }
    
    // Sort column clusters by left coordinate
    colClusters.sort((a, b) => (a.sum / a.count) - (b.sum / b.count));
    const colCount = colClusters.length;
    
    // Map each cell in each row to its corresponding column cluster
    let tableText = "";
    for (const row of rows) {
      const rowCells = Array(colCount).fill("");
      for (const el of row) {
        let bestColIdx = 0;
        let minDiff = 999999;
        for (let i = 0; i < colCount; i++) {
          const colLeft = colClusters[i].sum / colClusters[i].count;
          const diff = Math.abs(el.left - colLeft);
          if (diff < minDiff) {
            minDiff = diff;
            bestColIdx = i;
          }
        }
        rowCells[bestColIdx] = el.text;
      }
      tableText += rowCells.join(" | ") + "\n";
    }
    
    return tableText;
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

    // 3b. Extract Custom Div/Grid Sizing Containers
    try {
      const customContainers = findSizingContainers(document);
      let customIndex = 1;
      for (const container of customContainers) {
        const reconstructed = reconstructGridFromContainer(container);
        if (reconstructed && reconstructed.trim().length > 30) {
          if (!tableHtml.includes(reconstructed.substring(0, 30))) {
            tableHtml += `[Custom Size Chart #${customIndex}]:\n${reconstructed}\n\n`;
            customIndex++;
          }
        }
        if (customIndex > 3) break;
      }
    } catch (e) {
      console.warn("Styla custom grid scraping failed:", e);
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

  // 2. Check if a size chart was found
  const hasTable = data.tableHtml && data.tableHtml.trim().length > 0;

  if (!hasTable) {
    const btn = findSizeChartButton();
    if (btn) {
      console.log("Styla: Found size chart button. Clicking automatically...", btn);
      try {
        btn.click();
        
        // Wait 800ms for modal rendering
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Scrape again
        const newData = scrapePage();
        const hasNewTable = newData.tableHtml && newData.tableHtml.trim().length > 0;
        
        if (hasNewTable) {
          data = newData;
          console.log("Styla: Successfully scraped size chart after clicking button.");
        }
        
        // Close the modal/drawer to restore screen state
        clickCloseButton();
      } catch (e) {
        console.error("Styla: Auto-clicking size guide button failed:", e);
      }
    }
  }

  return data;
})();
