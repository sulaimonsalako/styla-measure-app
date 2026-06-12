document.addEventListener('DOMContentLoaded', async () => {
  const chestInput = document.getElementById('chest');
  const waistInput = document.getElementById('waist');
  const hipsInput = document.getElementById('hips');
  const heightFtInput = document.getElementById('height-ft');
  const heightInInput = document.getElementById('height-in');
  const inseamInput = document.getElementById('inseam');

  const syncStatus = document.getElementById('sync-status');
  const syncDot = document.getElementById('sync-dot');
  const syncText = document.getElementById('sync-text');

  const analyzeBtn = document.getElementById('analyze-btn');
  const loaderPanel = document.getElementById('loader-panel');
  const loaderStatus = document.getElementById('loader-status');
  const resultPanel = document.getElementById('result-panel');

  const recSize = document.getElementById('rec-size');
  const explanation = document.getElementById('explanation');
  const breakdownList = document.getElementById('breakdown-list');
  const warningContainer = document.getElementById('warning-container');
  const warningText = document.getElementById('warning-text');

  let activeApiHost = '';
  let scrapedProductContext = null;
  let chatHistory = [];

  // Helper to convert total inches into Ft and In
  function setHeightFields(totalInchesStr) {
    const totalInches = parseInt(totalInchesStr, 10);
    if (!isNaN(totalInches) && totalInches > 0) {
      heightFtInput.value = Math.floor(totalInches / 12);
      heightInInput.value = totalInches % 12;
    } else {
      heightFtInput.value = '';
      heightInInput.value = '';
    }
  }

  // Helper to calculate total inches from Ft/In inputs
  function getTotalHeightInches() {
    const ft = parseInt(heightFtInput.value, 10) || 0;
    const inch = parseInt(heightInInput.value, 10) || 0;
    const total = (ft * 12) + inch;
    return total > 0 ? total.toString() : '';
  }

  // Helper to download, resize, and compress image as JPEG to save network payload
  async function downloadImageAsBase64(url, maxDim = 1024, quality = 0.7) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (err) => reject(err);
        image.src = URL.createObjectURL(blob);
      });

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(img.src);

      return canvas.toDataURL('image/jpeg', quality);
    } catch (err) {
      console.warn("Could not download/compress image locally in extension:", url, err);
      return null;
    }
  }

  // 1. Load cached measurements and connection host
  const data = await chrome.storage.local.get(['measurements', 'apiHost']);
  if (data.measurements) {
    const m = data.measurements;
    if (m.chest) chestInput.value = m.chest;
    if (m.waist) waistInput.value = m.waist;
    if (m.hips) hipsInput.value = m.hips;
    if (m.inseam) inseamInput.value = m.inseam;
    if (m.height) setHeightFields(m.height);

    // Show synced badge
    syncStatus.classList.remove('unsynced');
    syncDot.classList.remove('unsynced');
    syncText.textContent = "Synced";
  }

  if (data.apiHost) {
    activeApiHost = data.apiHost;
    console.log("Active API Host synced from Styla app:", activeApiHost);
  }

  // 1b. Check if the active tab is a Styla website, and if so, force an instant sync!
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && (
      activeTab.url.includes("localhost") || 
      activeTab.url.includes("127.0.0.1") || 
      activeTab.url.includes("vercel.app") || 
      activeTab.url.includes("styla.ca")
    )) {
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          return {
            chest: localStorage.getItem("styla_twin_chest"),
            waist: localStorage.getItem("styla_twin_waist"),
            hips: localStorage.getItem("styla_twin_hips"),
            height: localStorage.getItem("styla_twin_height"),
            inseam: localStorage.getItem("styla_twin_inseam"),
            origin: window.location.origin
          };
        }
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const m = results[0].result;
          if (m.chest || m.waist || m.hips) {
            chrome.storage.local.set({ 
              measurements: {
                chest: m.chest || "",
                waist: m.waist || "",
                hips: m.hips || "",
                height: m.height || "",
                inseam: m.inseam || ""
              },
              apiHost: m.origin
            }, () => {
              if (m.chest) chestInput.value = m.chest;
              if (m.waist) waistInput.value = m.waist;
              if (m.hips) hipsInput.value = m.hips;
              if (m.inseam) inseamInput.value = m.inseam;
              if (m.height) setHeightFields(m.height);

              syncStatus.classList.remove("unsynced");
              syncDot.classList.remove("unsynced");
              syncText.textContent = "Synced";
              activeApiHost = m.origin;
              console.log("Instant sync from active tab completed:", m);
            });
          }
        }
      });
    }
  } catch (err) {
    console.log("Active tab check/sync skipped:", err);
  }

  // 2. Persist local manual changes
  const inputs = [chestInput, waistInput, hipsInput, heightFtInput, heightInInput, inseamInput];
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      const updatedMeasurements = {
        chest: chestInput.value,
        waist: waistInput.value,
        hips: hipsInput.value,
        height: getTotalHeightInches(),
        inseam: inseamInput.value
      };
      chrome.storage.local.set({ measurements: updatedMeasurements });
    });
  });

  // Helper to update loading phases
  function setLoaderPhase(text) {
    loaderStatus.textContent = text;
  }

  // Helper to extract context (either silent or for verdict panel)
  async function getProductContext() {
    if (scrapedProductContext) {
      return scrapedProductContext;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error("Could not detect active browser window.");
    }



    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content-analyzer.js"]
      }, async (results) => {
        try {
          if (!results || results.length === 0) {
            throw new Error("Failed to scan page content. Check that this is a public product page.");
          }

          // Combine results collected from all frames
          let pageTitle = "";
          let pageText = "";
          let tableHtml = "";
          const imageUrls = [];

          for (const frameResult of results) {
            const data = frameResult.result;
            if (!data) continue;

            if (data.pageTitle && !pageTitle) pageTitle = data.pageTitle;
            if (data.pageText) pageText += data.pageText + "\n";
            if (data.tableHtml) tableHtml += data.tableHtml + "\n";
            if (data.imageUrls) {
              data.imageUrls.forEach(url => {
                if (!imageUrls.includes(url)) imageUrls.push(url);
              });
            }
          }

          if (!pageTitle && !pageText && imageUrls.length === 0) {
            throw new Error("Failed to extract details from any page module.");
          }

          pageText = pageText.substring(0, 6000);
          
          const imagesBase64 = [];
          if (imageUrls.length > 0) {
            const urlsToFetch = imageUrls.slice(0, 15);
            for (const url of urlsToFetch) {
              const base64 = await downloadImageAsBase64(url);
              if (base64) {
                imagesBase64.push(base64);
              }
            }
          }

          scrapedProductContext = {
            pageTitle,
            pageText,
            tableHtml,
            imagesBase64,
            frameCount: results.length,
            scrapedImagesCount: imageUrls.length
          };
          resolve(scrapedProductContext);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // 3. Handle Page Analysis Trigger
  analyzeBtn.addEventListener('click', async () => {
    const chest = chestInput.value.trim();
    const waist = waistInput.value.trim();
    const hips = hipsInput.value.trim();
    const height = getTotalHeightInches();
    const inseam = inseamInput.value.trim();

    if (!chest || !waist || !hips) {
      alert("Please fill in at least your Chest, Waist, and Hips measurements to calculate fit.");
      return;
    }

    // Adjust UI state
    analyzeBtn.disabled = true;
    loaderPanel.style.display = 'block';
    resultPanel.style.display = 'none';
    setLoaderPhase("Pre-loading page details...");

    try {
      scrapedProductContext = null;
      const context = await getProductContext();

      setLoaderPhase("Matching measurements with fabric & style...");

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let host = activeApiHost;
      if (!host) {
        if (tab.url.includes('localhost') || tab.url.includes('127.0.0.1')) {
          host = 'http://localhost:3000';
        } else {
          host = 'https://styla-measure-app.vercel.app';
        }
      }
      const apiUrl = `${host}/api/extension-decode`;

      // Post payload to backend
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chest, waist, hips, height, inseam,
          pageTitle: context.pageTitle,
          pageText: context.pageText,
          tableHtml: context.tableHtml,
          imagesBase64: context.imagesBase64
        })
      });

      if (!res.ok) {
        let errorMsg = `Server error: ${res.status} ${res.statusText}`;
        try {
          const errData = await res.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch (_) {
          try {
            const text = await res.text();
            if (text && text.length < 150) errorMsg = text;
          } catch (__) {}
        }
        throw new Error(errorMsg + "\n\nTip: Make sure your backend API is deployed and running at: " + apiUrl);
      }

      let resData;
      try {
        resData = await res.json();
      } catch (jsonErr) {
        console.error("Failed to parse JSON response:", jsonErr);
        throw new Error("The server returned an invalid response (not JSON).\n\nTip: Make sure the API endpoint is deployed and running at: " + apiUrl);
      }

      // Handle Sizing Verdict
      if (!resData.recommended_size || resData.recommended_size === "null" || resData.recommended_size.toLowerCase() === "none" || resData.recommended_size.toLowerCase() === "null") {
        recSize.textContent = "No Chart Detected";
        recSize.style.background = "linear-gradient(135deg, #475569 0%, #334155 100%)";
        explanation.textContent = resData.explanation || "We couldn't detect a size chart image or table on this page.";
        breakdownList.innerHTML = '';
        
        const debugInfo = `(Scraped: ${context.scrapedImagesCount} images, ${context.tableHtml.length > 0 ? 'tables found' : 'no tables'} across ${context.frameCount} frame modules)`;
        warningText.innerHTML = `${resData.warning || "Please locate the size chart on the page first, make sure it is open/visible, and try running the analysis again."}<br/><br/><small style="color: #94a3b8; font-size: 10px;">Diagnostics: ${debugInfo}</small>`;
        warningContainer.style.display = "block";
      } else {
        recSize.textContent = resData.recommended_size;
        recSize.style.background = "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)";
        explanation.textContent = resData.explanation;

        breakdownList.innerHTML = '';
        if (resData.fit_breakdown) {
          Object.entries(resData.fit_breakdown).forEach(([key, val]) => {
            const item = document.createElement('div');
            item.className = 'fit-item';
            
            const label = document.createElement('span');
            label.className = 'fit-label';
            label.textContent = key.charAt(0).toUpperCase() + key.slice(1);
            
            const value = document.createElement('span');
            value.className = 'fit-value';
            value.textContent = val;

            item.appendChild(label);
            item.appendChild(value);
            breakdownList.appendChild(item);
          });
        }

        if (resData.warning && resData.warning.toLowerCase() !== 'none' && resData.warning.trim() !== '') {
          warningText.textContent = resData.warning;
          warningContainer.style.display = 'block';
        } else {
          warningContainer.style.display = 'none';
        }
      }

      resultPanel.style.display = 'block';

    } catch (innerErr) {
      console.error(innerErr);
      alert(innerErr.message);
    } finally {
      loaderPanel.style.display = 'none';
      analyzeBtn.disabled = false;
    }
  });

  // --- 4. Tab Switching Navigation ---
  const tabVerdict = document.getElementById('tab-verdict');
  const tabChat = document.getElementById('tab-chat');
  const verdictSection = document.getElementById('verdict-section');
  const chatSection = document.getElementById('chat-section');

  tabVerdict.addEventListener('click', () => {
    tabVerdict.classList.add('active');
    tabChat.classList.remove('active');
    verdictSection.style.display = 'block';
    chatSection.style.display = 'none';
  });

  tabChat.addEventListener('click', () => {
    tabChat.classList.add('active');
    tabVerdict.classList.remove('active');
    verdictSection.style.display = 'none';
    chatSection.style.display = 'block';
  });

  // --- 5. Interactive Sizing Chat Assistant ---
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatMessages = document.getElementById('chat-messages');

  function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;
    msgDiv.innerHTML = text.replace(/\n/g, '<br/>');
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function handleChatSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    appendMessage('user', text);

    if (!scrapedProductContext) {
      appendMessage('system', "Analyzing page details to load styling context...");
      try {
        await getProductContext();
        appendMessage('system', "Context loaded. Analyzing your question...");
      } catch (err) {
        appendMessage('model', "Sorry, I couldn't extract the product details from the page. Please make sure this is a product page.");
        return;
      }
    }

    chatHistory.push({ role: 'user', text: text });
    
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'chat-message model loading-indicator';
    loadingMessage.textContent = 'Typing...';
    chatMessages.appendChild(loadingMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const chest = chestInput.value.trim() || '34';
      const waist = waistInput.value.trim() || '30';
      const hips = hipsInput.value.trim() || '34';
      const height = getTotalHeightInches();
      const inseam = inseamInput.value.trim();

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let host = activeApiHost;
      if (!host) {
        if (tab.url.includes('localhost') || tab.url.includes('127.0.0.1')) {
          host = 'http://localhost:3000';
        } else {
          host = 'https://styla-measure-app.vercel.app';
        }
      }
      const apiUrl = `${host}/api/extension-chat`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chest, waist, hips, height, inseam,
          pageTitle: scrapedProductContext.pageTitle,
          pageText: scrapedProductContext.pageText,
          tableHtml: scrapedProductContext.tableHtml,
          imagesBase64: scrapedProductContext.imagesBase64,
          history: chatHistory
        })
      });

      loadingMessage.remove();

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const resData = await res.json();
      if (resData.error) {
        throw new Error(resData.error);
      }

      const reply = resData.reply || "I'm sorry, I couldn't generate a reply.";
      appendMessage('model', reply);
      chatHistory.push({ role: 'model', text: reply });

    } catch (err) {
      loadingMessage.remove();
      appendMessage('model', `Failed to get response: ${err.message}`);
    }
  }

  chatSendBtn.addEventListener('click', handleChatSend);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleChatSend();
    }
  });
});
