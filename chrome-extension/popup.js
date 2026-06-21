document.addEventListener('DOMContentLoaded', async () => {
  const chestInput = document.getElementById('chest');
  const waistInput = document.getElementById('waist');
  const bellyInput = document.getElementById('belly');
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

  // Guest 3D Scan / Manual references
  const btnModeManual = document.getElementById('btn-mode-manual');
  const btnModeScan = document.getElementById('btn-mode-scan');
  const manualProfileCard = document.getElementById('manual-profile-card');
  const scanSetupCard = document.getElementById('scan-setup-card');
  const scanFrontFile = document.getElementById('scan-front-file');
  const scanSideFile = document.getElementById('scan-side-file');
  const labelFrontText = document.getElementById('label-front-text');
  const labelSideText = document.getElementById('label-side-text');
  const btnUploadFront = document.getElementById('btn-upload-front');
  const btnUploadSide = document.getElementById('btn-upload-side');
  const btnRunScan = document.getElementById('btn-run-scan');

  // Cloud signup references
  const btnAuthModeLogin = document.getElementById('btn-auth-mode-login');
  const btnAuthModeSignup = document.getElementById('btn-auth-mode-signup');
  const cloudLoginForm = document.getElementById('cloud-login-form');
  const cloudSignupForm = document.getElementById('cloud-signup-form');
  const btnCloudSignup = document.getElementById('btn-cloud-signup');
  const cloudSignupError = document.getElementById('cloud-signup-error');
  const signupEmailInput = document.getElementById('signup-email');
  const signupPasswordInput = document.getElementById('signup-password');

  let frontBase64 = null;
  let sideBase64 = null;


  let activeApiHost = '';
  let pushTimeout = null;
  let scrapedProductContext = null;
  let chatHistory = [];
  let currentScanResult = null;

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

  // Helper to update Fit Match Score & Fit Spectrum Slider
  function updateFitScoreAndSpectrum(resData) {
    const fitScoreBadge = document.getElementById('fit-score-badge');
    const fitSpectrumPointer = document.getElementById('fit-spectrum-pointer');

    if (fitScoreBadge) {
      if (resData.fit_match_score !== undefined && resData.fit_match_score !== null) {
        fitScoreBadge.textContent = resData.fit_match_score + "%";
        if (resData.fit_match_score >= 85) {
          fitScoreBadge.style.color = "#10b981"; // green
        } else if (resData.fit_match_score >= 70) {
          fitScoreBadge.style.color = "#f59e0b"; // amber
        } else {
          fitScoreBadge.style.color = "#ef4444"; // red
        }
      } else {
        fitScoreBadge.textContent = "--";
        fitScoreBadge.style.color = "var(--accent)";
      }
    }

    if (fitSpectrumPointer) {
      const spectrumValue = (resData.fit_spectrum || 'ideal').toLowerCase();
      let position = '50%';
      if (spectrumValue === 'tight') position = '8%';
      else if (spectrumValue === 'slim') position = '30%';
      else if (spectrumValue === 'ideal') position = '50%';
      else if (spectrumValue === 'relaxed' || spectrumValue === 'loose') position = '70%';
      else if (spectrumValue === 'oversized') position = '92%';
      fitSpectrumPointer.style.left = position;
    }
  }

  // Helper to save current page state to chrome.storage.local
  async function savePageState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab) return;
      
      const state = {
        url: tab.url,
        scrapedProductContext,
        lastScanResult: currentScanResult,
        chatHistory,
        chatMessagesHtml: chatMessages.innerHTML
      };
      
      await chrome.storage.local.set({ savedPageState: state });
    } catch (err) {
      console.warn("Failed to save page state:", err);
    }
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

  function updateActiveScanBadge(measurements) {
    const badge = document.getElementById('active-scan-badge');
    if (!badge) return;
    const activeScan = measurements && measurements.api_scans && Array.isArray(measurements.api_scans)
      ? measurements.api_scans.find(s => s.is_active)
      : null;
    if (activeScan) {
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  // Toggle Scan vs Manual inputs
  if (btnModeManual && btnModeScan && manualProfileCard && scanSetupCard) {
    btnModeManual.addEventListener('click', () => {
      btnModeManual.classList.add('active');
      btnModeScan.classList.remove('active');
      manualProfileCard.style.display = 'block';
      scanSetupCard.style.display = 'none';
    });

    btnModeScan.addEventListener('click', () => {
      btnModeScan.classList.add('active');
      btnModeManual.classList.remove('active');
      manualProfileCard.style.display = 'none';
      scanSetupCard.style.display = 'block';
    });
  }

  // Handle Photo selection & compression
  if (scanFrontFile && btnUploadFront) {
    scanFrontFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        labelFrontText.textContent = "Loading...";
        btnUploadFront.style.borderColor = "var(--accent)";
        try {
          frontBase64 = await compressFileImage(file);
          labelFrontText.textContent = "Front Loaded!";
          btnUploadFront.style.borderColor = "var(--success)";
        } catch (err) {
          labelFrontText.textContent = "Error!";
          btnUploadFront.style.borderColor = "var(--error)";
        }
      }
    });
  }

  if (scanSideFile && btnUploadSide) {
    scanSideFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        labelSideText.textContent = "Loading...";
        btnUploadSide.style.borderColor = "var(--accent)";
        try {
          sideBase64 = await compressFileImage(file);
          labelSideText.textContent = "Side Loaded!";
          btnUploadSide.style.borderColor = "var(--success)";
        } catch (err) {
          labelSideText.textContent = "Error!";
          btnUploadSide.style.borderColor = "var(--error)";
        }
      }
    });
  }

  if (btnRunScan) {
    btnRunScan.addEventListener('click', async () => {
      const gender = document.getElementById('scan-gender').value;
      const weight = Number(document.getElementById('scan-weight').value) || 140;
      const ft = Number(document.getElementById('scan-height-ft').value) || 5;
      const inch = Number(document.getElementById('scan-height-in').value) || 4;
      const heightInches = (ft * 12) + inch;
      const heightCm = Math.round(heightInches * 2.54);

      if (!frontBase64 || !sideBase64) {
        alert("Please upload both front and side photos for the AI Sizing scan.");
        return;
      }

      btnRunScan.disabled = true;
      btnRunScan.textContent = "Initializing Scan...";

      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        let host = activeApiHost;
        if (!host) {
          if (tab.url.includes('localhost') || tab.url.includes('127.0.0.1')) {
            host = 'http://localhost:3000';
          } else {
            host = 'https://www.styla.ca';
          }
        }

        const initRes = await fetch(`${host}/api/3dlook/init-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gender,
            height: heightCm,
            weight: Math.round(weight * 0.453592),
            front_image: frontBase64,
            side_image: sideBase64
          })
        });

        if (!initRes.ok) {
          const errData = await initRes.json();
          throw new Error(errData.error || "Failed to initialize AI Sizing session.");
        }

        const session = await initRes.json();
        btnRunScan.textContent = "Processing Body (10s)...";

        let pollUrl = session.task_set_url;
        if (pollUrl && !pollUrl.startsWith('http')) {
          pollUrl = `${host}${pollUrl}`;
        }

        const pollStatus = async () => {
          try {
            const statusRes = await fetch(pollUrl);
            const statusData = await statusRes.json();
            if (statusData.is_ready && statusData.is_successful) {
              btnRunScan.textContent = "Finalizing Measurements...";
              
              let saveUrl = statusData.redirect_to;
              if (saveUrl && !saveUrl.startsWith('http')) {
                saveUrl = `${host}${saveUrl}`;
              }
              
              const sessionData = await chrome.storage.local.get(['supabaseSession']);
              const username = sessionData.supabaseSession ? sessionData.supabaseSession.user.email : 'guest';
              
              const saveRes = await fetch(`${saveUrl}&username=${username}`);
              const saveData = await saveRes.json();
              
              if (saveData.success) {
                const currentMeasurements = (await chrome.storage.local.get(['measurements'])).measurements || {};
                const updatedMeasurements = {
                  ...currentMeasurements,
                  chest: saveData.twin.chest,
                  waist: saveData.twin.waist,
                  belly: saveData.twin.belly || saveData.twin.waist,
                  hips: saveData.twin.hips,
                  height: heightInches.toString(),
                  inseam: saveData.twin.inseam,
                  api_scans: saveData.api_scans,
                  measurement_overrides: currentMeasurements.measurement_overrides || {}
                };
                
                await chrome.storage.local.set({ measurements: updatedMeasurements });
                
                chestInput.value = saveData.twin.chest;
                waistInput.value = saveData.twin.waist;
                bellyInput.value = saveData.twin.belly || saveData.twin.waist;
                hipsInput.value = saveData.twin.hips;
                setHeightFields(heightInches.toString());
                inseamInput.value = saveData.twin.inseam;
                
                updateActiveScanBadge(updatedMeasurements);
                alert("AI Sizing Scan complete! 80+ measurements loaded into local AI Tailor Profile.");
                btnModeManual.click();
              } else {
                throw new Error("Failed to save measurements.");
              }
            } else {
              setTimeout(pollStatus, 2000);
            }
          } catch (pollErr) {
            btnRunScan.disabled = false;
            btnRunScan.textContent = "Run AI Sizing Scan";
            alert("Polling Error: " + pollErr.message);
          }
        };

        setTimeout(pollStatus, 2000);

      } catch (err) {
        alert("Scanner Error: " + err.message);
        btnRunScan.disabled = false;
        btnRunScan.textContent = "Run AI Sizing Scan";
      }
    });
  }

  // Toggle Login vs Signup form
  if (btnAuthModeLogin && btnAuthModeSignup && cloudLoginForm && cloudSignupForm) {
    btnAuthModeLogin.addEventListener('click', () => {
      btnAuthModeLogin.classList.add('active');
      btnAuthModeSignup.classList.remove('active');
      cloudLoginForm.style.display = 'block';
      cloudSignupForm.style.display = 'none';
    });

    btnAuthModeSignup.addEventListener('click', () => {
      btnAuthModeSignup.classList.add('active');
      btnAuthModeLogin.classList.remove('active');
      cloudLoginForm.style.display = 'none';
      cloudSignupForm.style.display = 'block';
    });
  }

  // Handle Cloud Sign Up Click
  if (btnCloudSignup) {
    btnCloudSignup.addEventListener('click', async () => {
      const email = signupEmailInput.value.trim();
      const password = signupPasswordInput.value;

      if (!email || !password || password.length < 6) {
        cloudSignupError.textContent = "Please fill in a valid email and a password (min 6 characters).";
        cloudSignupError.style.display = 'block';
        return;
      }

      btnCloudSignup.disabled = true;
      btnCloudSignup.textContent = "Creating Account...";
      cloudSignupError.style.display = 'none';

      try {
        const storageData = await chrome.storage.local.get(['measurements']);
        const m = storageData.measurements || {};
        
        const payload = {
          email,
          password,
          options: {
            data: {
              chest: m.chest ? parseFloat(m.chest) : null,
              waist: m.waist ? parseFloat(m.waist) : null,
              belly: m.belly ? parseFloat(m.belly) : null,
              hips: m.hips ? parseFloat(m.hips) : null,
              height: m.height ? parseFloat(m.height) : null,
              inseam: m.inseam ? parseFloat(m.inseam) : null,
              api_scans: m.api_scans || [],
              measurement_overrides: m.measurement_overrides || {}
            }
          }
        };

        const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error_description || errData.error || "Signup failed.");
        }

        // Auto-login after signup to get session
        const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        if (loginRes.ok) {
          const session = await loginRes.json();
          if (!session.expires_at && session.expires_in) {
            session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
          }
          await chrome.storage.local.set({ supabaseSession: session });
          cloudProfilePanel.style.display = 'block';
          cloudUserEmail.textContent = session.user.email;
          cloudSignupForm.style.display = 'none';
          
          await pushMeasurements(session);
        } else {
          alert("Account created! Please log in on the Cloud tab to sync.");
          btnAuthModeLogin.click();
        }

        signupEmailInput.value = '';
        signupPasswordInput.value = '';

      } catch (err) {
        cloudSignupError.textContent = err.message;
        cloudSignupError.style.display = 'block';
      } finally {
        btnCloudSignup.disabled = false;
        btnCloudSignup.textContent = "Sign Up & Sync";
      }
    });
  }

  // 1. Load cached measurements and connection host
  const data = await chrome.storage.local.get(['measurements', 'apiHost']);
  if (data.measurements) {
    const m = data.measurements;
    if (m.chest) chestInput.value = m.chest;
    if (m.waist) waistInput.value = m.waist;
    if (m.belly) bellyInput.value = m.belly;
    if (m.hips) hipsInput.value = m.hips;
    if (m.inseam) inseamInput.value = m.inseam;
    if (m.height) setHeightFields(m.height);
    updateActiveScanBadge(m);

    // Show synced badge
    syncStatus.classList.remove('unsynced');
    syncDot.classList.remove('unsynced');
    syncText.textContent = "Synced";
  }

  // Listen for storage changes to sync in real-time if popup is open
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.measurements) {
      const m = changes.measurements.newValue;
      if (m) {
        if (m.chest) chestInput.value = m.chest;
        if (m.waist) waistInput.value = m.waist;
        if (m.belly) bellyInput.value = m.belly;
        if (m.hips) hipsInput.value = m.hips;
        if (m.inseam) inseamInput.value = m.inseam;
        if (m.height) setHeightFields(m.height);
        updateActiveScanBadge(m);
      }
    }
  });

  if (data.apiHost) {
    activeApiHost = data.apiHost;
    console.log("Active API Host synced from Styla app:", activeApiHost);
  }

  // 1b. Check if the active tab is a Styla website, and if so, force an instant sync!
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
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
            belly: localStorage.getItem("styla_twin_belly"),
            hips: localStorage.getItem("styla_twin_hips"),
            height: localStorage.getItem("styla_twin_height"),
            inseam: localStorage.getItem("styla_twin_inseam"),
            origin: window.location.origin
          };
        }
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const m = results[0].result;
          if (m.chest || m.waist || m.belly || m.hips) {
            chrome.storage.local.set({ 
              measurements: {
                chest: m.chest || "",
                waist: m.waist || "",
                belly: m.belly || "",
                hips: m.hips || "",
                height: m.height || "",
                inseam: m.inseam || ""
              },
              apiHost: m.origin
            }, () => {
              if (m.chest) chestInput.value = m.chest;
              if (m.waist) waistInput.value = m.waist;
              if (m.belly) bellyInput.value = m.belly;
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

  // Helper to compare URLs ignoring query parameters, hashes, and trailing slashes
  function urlsMatch(url1, url2) {
    if (!url1 || !url2) return false;
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      const path1 = u1.pathname.replace(/\/$/, "");
      const path2 = u2.pathname.replace(/\/$/, "");
      return u1.host === u2.host && path1 === path2;
    } catch (e) {
      return url1 === url2;
    }
  }

  // 1c. Restore saved state if the tab URL matches the saved state's URL!
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab) {
      const stateData = await chrome.storage.local.get(['savedPageState']);
      if (stateData.savedPageState && urlsMatch(stateData.savedPageState.url, activeTab.url)) {
        const state = stateData.savedPageState;
        scrapedProductContext = state.scrapedProductContext;
        chatHistory = state.chatHistory || [];
        currentScanResult = state.lastScanResult;

        if (state.chatMessagesHtml) {
          chatMessages.innerHTML = state.chatMessagesHtml;
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Render the sizing verdict if present
        if (currentScanResult) {
          const resData = currentScanResult;
          if (!resData.recommended_size || resData.recommended_size === "null" || resData.recommended_size.toLowerCase() === "none" || resData.recommended_size.toLowerCase() === "null") {
            recSize.textContent = "No Chart Detected";
            recSize.style.background = "linear-gradient(135deg, #475569 0%, #334155 100%)";
            explanation.textContent = resData.explanation || "We couldn't detect a size chart image or table on this page.";
            breakdownList.innerHTML = '';
            updateFitScoreAndSpectrum({});
            
            const debugInfo = `(Scraped: ${scrapedProductContext ? scrapedProductContext.scrapedImagesCount : 0} images, ${scrapedProductContext && scrapedProductContext.tableHtml.length > 0 ? 'tables found' : 'no tables'})`;
            warningText.innerHTML = `${resData.warning || "Please locate the size chart on the page first, make sure it is open/visible, and try running the analysis again."}<br/><br/><small style="color: #94a3b8; font-size: 10px;">Diagnostics: ${debugInfo}</small>`;
            warningContainer.style.display = "block";
          } else {
            recSize.textContent = resData.recommended_size;
            recSize.style.background = "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)";
            explanation.textContent = resData.explanation;
            updateFitScoreAndSpectrum(resData);

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
        }
      }
    }
  } catch (err) {
    console.log("State restoration skipped:", err);
  }

  // 2. Persist local manual changes
  const inputs = [chestInput, waistInput, bellyInput, hipsInput, heightFtInput, heightInInput, inseamInput];
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      const updatedMeasurements = {
        chest: chestInput.value,
        waist: waistInput.value,
        belly: bellyInput.value,
        hips: hipsInput.value,
        height: getTotalHeightInches(),
        inseam: inseamInput.value
      };
      chrome.storage.local.set({ measurements: updatedMeasurements });
      triggerPushDebounce();
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

    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
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
    const belly = bellyInput.value.trim();
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
      // Reset chat history and messages list on new page analysis run
      chatHistory = [];
      chatMessages.innerHTML = `
        <div class="chat-message model">
          Hello! I've analyzed this product. Ask me anything about its fit, stretch, or compare other sizes to your measurements!
        </div>
      `;

      scrapedProductContext = null;
      const context = await getProductContext();

      setLoaderPhase("Matching measurements with fabric & style...");

      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      let host = activeApiHost;
      if (!host) {
        if (tab.url.includes('localhost') || tab.url.includes('127.0.0.1')) {
          host = 'http://localhost:3000';
        } else {
          host = 'https://www.styla.ca';
        }
      }
      const apiUrl = `${host}/api/extension-decode`;

      // Post payload to backend
      const storageData = await chrome.storage.local.get(['measurements']);
      const api_scans = storageData.measurements?.api_scans || [];
      const measurement_overrides = storageData.measurements?.measurement_overrides || {};

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chest, waist, belly, hips, height, inseam,
          api_scans,
          measurement_overrides,
          pageTitle: context.pageTitle,
          pageText: context.pageText,
          tableHtml: context.tableHtml,
          imagesBase64: context.imagesBase64,
          url: context.url
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

      currentScanResult = resData;

      // Handle Sizing Verdict
      if (!resData.recommended_size || resData.recommended_size === "null" || resData.recommended_size.toLowerCase() === "none" || resData.recommended_size.toLowerCase() === "null") {
        recSize.textContent = "No Chart Detected";
        recSize.style.background = "linear-gradient(135deg, #475569 0%, #334155 100%)";
        explanation.textContent = resData.explanation || "We couldn't detect a size chart image or table on this page.";
        breakdownList.innerHTML = '';
        updateFitScoreAndSpectrum({});
        
        const debugInfo = `(Scraped: ${context.scrapedImagesCount} images, ${context.tableHtml.length > 0 ? 'tables found' : 'no tables'} across ${context.frameCount} frame modules)`;
        warningText.innerHTML = `${resData.warning || "Please locate the size chart on the page first, make sure it is open/visible, and try running the analysis again."}<br/><br/><small style="color: #94a3b8; font-size: 10px;">Diagnostics: ${debugInfo}</small>`;
        warningContainer.style.display = "block";
      } else {
        recSize.textContent = resData.recommended_size;
        recSize.style.background = "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)";
        explanation.textContent = resData.explanation;
        updateFitScoreAndSpectrum(resData);

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

        // Prime chat history with initial analysis details so chatbot has context
        const initialAnalysis = "Here is the garment sizing analysis for my measurements (Chest: " + chest + "\", Waist: " + waist + "\", Belly: " + belly + "\", Hips: " + hips + "\"): Recommended size is " + resData.recommended_size + ". Fit breakdown: Chest is " + (resData.fit_breakdown?.chest || '') + ", Waist is " + (resData.fit_breakdown?.waist || '') + ", Belly is " + (resData.fit_breakdown?.belly || '') + ", Hips is " + (resData.fit_breakdown?.hips || '') + ". Explanation: " + resData.explanation;
        const assistantGreeting = "I've analyzed your fit and recommended size " + resData.recommended_size + ". Have any questions about the sizing, fit details, or alterations for this item?";
        
        chatHistory = [
          { role: 'user', text: initialAnalysis },
          { role: 'model', text: assistantGreeting }
        ];
      }

      resultPanel.style.display = 'block';
      await savePageState();


    } catch (innerErr) {
      console.error(innerErr);
      alert(innerErr.message);
    } finally {
      loaderPanel.style.display = 'none';
      analyzeBtn.disabled = false;
    }
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
    await savePageState();
    
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

      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      let host = activeApiHost;
      if (!host) {
        if (tab.url.includes('localhost') || tab.url.includes('127.0.0.1')) {
          host = 'http://localhost:3000';
        } else {
          host = 'https://www.styla.ca';
        }
      }
      const apiUrl = `${host}/api/extension-chat`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chest, waist, belly, hips, height, inseam,
          pageTitle: scrapedProductContext.pageTitle,
          pageText: scrapedProductContext.pageText,
          tableHtml: scrapedProductContext.tableHtml,
          imagesBase64: scrapedProductContext.imagesBase64,
          history: chatHistory
        })
      });

      loadingMessage.remove();

      if (!res.ok) {
        let errorMsg = `Server returned ${res.status}`;
        try {
          const errData = await res.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch (_) {
          try {
            const text = await res.text();
            if (text && text.length < 150) errorMsg = text;
          } catch (__) {}
        }
        throw new Error(errorMsg);
      }

      const resData = await res.json();
      if (resData.error) {
        throw new Error(resData.error);
      }

      const reply = resData.reply || "I'm sorry, I couldn't generate a reply.";
      appendMessage('model', reply);
      chatHistory.push({ role: 'model', text: reply });
      await savePageState();

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

  // --- 6. Cloud Sync and Auth Interface ---
  const tabTwin = document.getElementById('tab-twin');
  const tabCloud = document.getElementById('tab-cloud');
  const sizingTabContent = document.getElementById('sizing-tab-content');
  const cloudTabContent = document.getElementById('cloud-tab-content');

  // Tab switching
  tabTwin.addEventListener('click', () => {
    tabTwin.classList.add('active');
    tabCloud.classList.remove('active');
    sizingTabContent.style.display = 'block';
    cloudTabContent.style.display = 'none';
  });

  tabCloud.addEventListener('click', () => {
    tabCloud.classList.add('active');
    tabTwin.classList.remove('active');
    sizingTabContent.style.display = 'none';
    cloudTabContent.style.display = 'block';
  });

  const cloudEmailInput = document.getElementById('cloud-email');
  const cloudPasswordInput = document.getElementById('cloud-password');
  const btnCloudLogin = document.getElementById('btn-cloud-login');
  const cloudLoginError = document.getElementById('cloud-login-error');
  const cloudLoginForm = document.getElementById('cloud-login-form');
  const cloudProfilePanel = document.getElementById('cloud-profile-panel');
  const cloudUserEmail = document.getElementById('cloud-user-email');
  const btnCloudPull = document.getElementById('btn-cloud-pull');
  const btnCloudPush = document.getElementById('btn-cloud-push');
  const btnCloudLogout = document.getElementById('btn-cloud-logout');
  const cloudSyncMsg = document.getElementById('cloud-sync-msg');

  const SUPABASE_URL = "https://tneflxtpmzodauygtslk.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZWZseHRwbXpvZGF1eWd0c2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzA1NTMsImV4cCI6MjA5MzkwNjU1M30.DkzB5-novfMp1IaY4d9710YTv_U7DME3_EC8Jc87MLc";

  // Helper to show messages in cloud sync panel
  function showSyncMsg(text, isError = false) {
    cloudSyncMsg.style.display = 'block';
    cloudSyncMsg.style.color = isError ? '#fca5a5' : '#10b981';
    cloudSyncMsg.textContent = text;
    setTimeout(() => {
      cloudSyncMsg.style.display = 'none';
    }, 4000);
  }

  // Get a valid session, refreshing it if expired
  async function getValidSession() {
    const data = await chrome.storage.local.get(['supabaseSession']);
    if (!data.supabaseSession) return null;

    let session = data.supabaseSession;
    const now = Math.floor(Date.now() / 1000);
    
    // If the token expires in less than 5 minutes (300 seconds), refresh it
    const isExpired = !session.expires_at || (session.expires_at - now < 300);
    
    if (isExpired && session.refresh_token) {
      console.log("Supabase session token expired or close to expiring. Refreshing...");
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        
        if (res.ok) {
          const newSession = await res.json();
          if (!newSession.expires_at && newSession.expires_in) {
            newSession.expires_at = Math.floor(Date.now() / 1000) + newSession.expires_in;
          }
          await chrome.storage.local.set({ supabaseSession: newSession });
          console.log("Token refreshed successfully.");
          return newSession;
        } else {
          console.warn("Token refresh failed. Response status:", res.status);
          // If refresh fails with invalid grant, the refresh token might be invalid/revoked.
          // We will clear session and prompt login
          await chrome.storage.local.remove('supabaseSession');
          return null;
        }
      } catch (err) {
        console.error("Failed to refresh token:", err);
        return session; // return existing one and let the request fail
      }
    }
    
    return session;
  }

  // Check Supabase Cloud Session on load
  async function checkCloudSession() {
    const session = await getValidSession();
    if (session) {
      cloudLoginForm.style.display = 'none';
      cloudProfilePanel.style.display = 'block';
      cloudUserEmail.textContent = session.user.email;
      
      // Auto-pull measurements on load silently
      await pullMeasurements(session, true);
    } else {
      cloudLoginForm.style.display = 'block';
      cloudProfilePanel.style.display = 'none';
    }
  }

  await checkCloudSession();

  // Log In & Pull Handler
  btnCloudLogin.addEventListener('click', async () => {
    const email = cloudEmailInput.value.trim();
    const password = cloudPasswordInput.value;

    if (!email || !password) {
      cloudLoginError.textContent = "Please fill in both email and password.";
      cloudLoginError.style.display = 'block';
      return;
    }

    btnCloudLogin.disabled = true;
    btnCloudLogin.textContent = "Logging in...";
    cloudLoginError.style.display = 'none';

    try {
      // Direct REST call to Supabase token endpoint
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error_description || errData.error || "Authentication failed.");
      }

      const session = await res.json();
      if (!session.expires_at && session.expires_in) {
        session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
      }
      await chrome.storage.local.set({ supabaseSession: session });

      cloudEmailInput.value = '';
      cloudPasswordInput.value = '';
      cloudLoginForm.style.display = 'none';
      cloudProfilePanel.style.display = 'block';
      cloudUserEmail.textContent = session.user.email;

      // Automatically pull measurements after login
      await pullMeasurements(session, false);

    } catch (err) {
      let msg = err.message;
      if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) {
        msg = "Failed to connect to the cloud database. If this is a free-tier Supabase project, it may have been automatically paused due to inactivity. Please log in to your Supabase dashboard at supabase.com and click 'Resume' to restore it.";
      }
      cloudLoginError.textContent = msg;
      cloudLoginError.style.display = 'block';
    } finally {
      btnCloudLogin.disabled = false;
      btnCloudLogin.textContent = "Log In & Pull";
    }
  });

  // Pull Measurements Helper
  async function pullMeasurements(session, silent = false) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.warn("Pull returned 401. Session expired or invalid. Logging out.");
          await chrome.storage.local.remove('supabaseSession');
          cloudLoginForm.style.display = 'block';
          cloudProfilePanel.style.display = 'none';
        }
        throw new Error("Failed to fetch cloud measurements.");
      }

      const profiles = await res.json();
      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        
        // Update input fields
        if (profile.chest) chestInput.value = profile.chest;
        if (profile.waist) waistInput.value = profile.waist;
        if (profile.belly) bellyInput.value = profile.belly;
        if (profile.hips) hipsInput.value = profile.hips;
        if (profile.inseam) inseamInput.value = profile.inseam;
        if (profile.height) setHeightFields(profile.height);

        // Update local storage
        const updatedMeasurements = {
          chest: chestInput.value,
          waist: waistInput.value,
          belly: bellyInput.value,
          hips: hipsInput.value,
          height: getTotalHeightInches(),
          inseam: inseamInput.value,
          api_scans: profile.api_scans || [],
          measurement_overrides: profile.measurement_overrides || {}
        };
        await chrome.storage.local.set({ measurements: updatedMeasurements });
        updateActiveScanBadge(updatedMeasurements);

        if (!silent) {
          showSyncMsg("Measurements successfully imported!");
        }
      } else {
        if (!silent) {
          showSyncMsg("No measurements found on your cloud profile.", true);
        }
      }
    } catch (err) {
      let msg = err.message;
      if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) {
        msg = "Failed to connect to the cloud database. If this is a free-tier Supabase project, it may have been automatically paused due to inactivity. Please log in to your Supabase dashboard at supabase.com and click 'Resume' to restore it.";
      }
      if (!silent) {
        showSyncMsg(msg, true);
      } else {
        console.warn("Silent auto-pull failed:", msg);
      }
    }
  }

  btnCloudPull.addEventListener('click', async () => {
    const session = await getValidSession();
    if (session) {
      btnCloudPull.disabled = true;
      await pullMeasurements(session, false);
      btnCloudPull.disabled = false;
    } else {
      showSyncMsg("Please log in first.", true);
    }
  });

  // Push Measurements Handler
  btnCloudPush.addEventListener('click', async () => {
    const session = await getValidSession();
    if (!session) {
      showSyncMsg("Please log in first.", true);
      return;
    }

    btnCloudPush.disabled = true;

    try {
      const chest = chestInput.value.trim();
      const waist = waistInput.value.trim();
      const belly = bellyInput.value.trim();
      const hips = hipsInput.value.trim();
      const inseam = inseamInput.value.trim();
      const height = getTotalHeightInches();

      const storageData = await chrome.storage.local.get(['measurements']);
      const m = storageData.measurements || {};
      const api_scans = m.api_scans || [];
      const measurement_overrides = m.measurement_overrides || {};

      // Direct REST call (PATCH) to update user profile
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          chest: chest ? parseFloat(chest) : null,
          waist: waist ? parseFloat(waist) : null,
          belly: belly ? parseFloat(belly) : null,
          hips: hips ? parseFloat(hips) : null,
          inseam: inseam ? parseFloat(inseam) : null,
          height: height ? parseFloat(height) : null,
          api_scans,
          measurement_overrides,
          updated_at: new Date().toISOString()
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.warn("Push returned 401. Session expired or invalid. Logging out.");
          await chrome.storage.local.remove('supabaseSession');
          cloudLoginForm.style.display = 'block';
          cloudProfilePanel.style.display = 'none';
        }
        throw new Error("Failed to push measurements to cloud.");
      }

      showSyncMsg("Measurements pushed to cloud!");
    } catch (err) {
      let msg = err.message;
      if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) {
        msg = "Failed to connect to the cloud database. If this is a free-tier Supabase project, it may have been automatically paused due to inactivity. Please log in to your Supabase dashboard at supabase.com and click 'Resume' to restore it.";
      }
      showSyncMsg(msg, true);
    } finally {
      btnCloudPush.disabled = false;
    }
  });

  // Debounced cloud sync helper for logged in users
  async function syncMeasurementsToCloud() {
    try {
      const session = await getValidSession();
      if (!session) return;

      const chest = chestInput.value.trim();
      const waist = waistInput.value.trim();
      const belly = bellyInput.value.trim();
      const hips = hipsInput.value.trim();
      const inseam = inseamInput.value.trim();
      const height = getTotalHeightInches();

      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          chest: chest ? parseFloat(chest) : null,
          waist: waist ? parseFloat(waist) : null,
          belly: belly ? parseFloat(belly) : null,
          hips: hips ? parseFloat(hips) : null,
          inseam: inseam ? parseFloat(inseam) : null,
          height: height ? parseFloat(height) : null,
          updated_at: new Date().toISOString()
        })
      });

      if (res.ok) {
        console.log("Successfully auto-pushed measurements to cloud.");
      } else if (res.status === 401) {
        console.warn("Auto-push returned 401. Session expired or invalid. Logging out.");
        await chrome.storage.local.remove('supabaseSession');
        cloudLoginForm.style.display = 'block';
        cloudProfilePanel.style.display = 'none';
      }
    } catch (err) {
      console.warn("Failed to auto-push measurements to cloud:", err);
    }
  }

  function triggerPushDebounce() {
    if (pushTimeout) clearTimeout(pushTimeout);
    pushTimeout = setTimeout(syncMeasurementsToCloud, 1500);
  }

  // Log Out Handler
  btnCloudLogout.addEventListener('click', async () => {
    await chrome.storage.local.remove('supabaseSession');
    cloudLoginForm.style.display = 'block';
    cloudProfilePanel.style.display = 'none';
    showSyncMsg("Logged out successfully.");
  });

  // ----------------- Manual Size Chart Image Uploader -----------------
  function compressFileImage(file, maxDim = 1024, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
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
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function runAnalysisWithImage(base64Image) {
    const chest = chestInput.value.trim();
    const waist = waistInput.value.trim();
    const belly = bellyInput.value.trim();
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
      chatHistory = [];
      chatMessages.innerHTML = `
        <div class="chat-message model">
          Hello! I've analyzed this product. Ask me anything about its fit, stretch, or compare other sizes to your measurements!
        </div>
      `;

      scrapedProductContext = null;
      let context = { pageTitle: "Uploaded Chart", pageText: "", tableHtml: "", imagesBase64: [base64Image], scrapedImagesCount: 1, frameCount: 1 };
      
      // Try to get scraped context just to keep product name/text if any, but override the image
      try {
        const scraped = await getProductContext();
        if (scraped) {
          context.pageTitle = scraped.pageTitle || context.pageTitle;
          context.pageText = scraped.pageText || context.pageText;
        }
      } catch (e) {
        console.log("Could not get background page context, using defaults:", e);
      }

      setLoaderPhase("Matching measurements with fabric & style...");

      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      let host = activeApiHost;
      if (!host) {
        if (tab && (tab.url.includes('localhost') || tab.url.includes('127.0.0.1'))) {
          host = 'http://localhost:3000';
        } else {
          host = 'https://www.styla.ca';
        }
      }
      const apiUrl = `${host}/api/extension-decode`;

      // Post payload to backend
      const storageData = await chrome.storage.local.get(['measurements']);
      const api_scans = storageData.measurements?.api_scans || [];
      const measurement_overrides = storageData.measurements?.measurement_overrides || {};

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chest, waist, belly, hips, height, inseam,
          api_scans,
          measurement_overrides,
          pageTitle: context.pageTitle,
          pageText: context.pageText,
          tableHtml: context.tableHtml,
          imagesBase64: context.imagesBase64,
          url: context.url
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
        throw new Error(errorMsg);
      }

      let resData;
      try {
        resData = await res.json();
      } catch (jsonErr) {
        console.error("Failed to parse JSON response:", jsonErr);
        throw new Error("The server returned an invalid response (not JSON).");
      }

      currentScanResult = resData;

      // Handle Sizing Verdict
      if (!resData.recommended_size || resData.recommended_size === "null" || resData.recommended_size.toLowerCase() === "none" || resData.recommended_size.toLowerCase() === "null") {
        recSize.textContent = "No Chart Detected";
        recSize.style.background = "linear-gradient(135deg, #475569 0%, #334155 100%)";
        explanation.textContent = resData.explanation || "We couldn't detect a size chart image or table on this page.";
        breakdownList.innerHTML = '';
        updateFitScoreAndSpectrum({});
        
        warningText.innerHTML = `${resData.warning || "Please locate the size chart on the page first, make sure it is open/visible, and try running the analysis again."}`;
        warningContainer.style.display = "block";
      } else {
        recSize.textContent = resData.recommended_size;
        recSize.style.background = "linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)";
        explanation.textContent = resData.explanation;
        updateFitScoreAndSpectrum(resData);

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

        // Prime chat history with initial analysis details so chatbot has context
        const initialAnalysis = "Here is the garment sizing analysis for my measurements (Chest: " + chest + "\", Waist: " + waist + "\", Belly: " + belly + "\", Hips: " + hips + "\"): Recommended size is " + resData.recommended_size + ". Fit breakdown: Chest is " + (resData.fit_breakdown?.chest || '') + ", Waist is " + (resData.fit_breakdown?.waist || '') + ", Belly is " + (resData.fit_breakdown?.belly || '') + ", Hips is " + (resData.fit_breakdown?.hips || '') + ". Explanation: " + resData.explanation;
        const assistantGreeting = "I've analyzed your fit and recommended size " + resData.recommended_size + ". Have any questions about the sizing, fit details, or alterations for this item?";
        
        chatHistory = [
          { role: 'user', text: initialAnalysis },
          { role: 'model', text: assistantGreeting }
        ];
      }
      
      resultPanel.style.display = 'block';
      
      // Save state
      await savePageState();

    } catch (err) {
      alert("Analysis failed: " + err.message);
    } finally {
      analyzeBtn.disabled = false;
      loaderPanel.style.display = 'none';
    }
  }

  const btnTriggerUpload = document.getElementById('btn-trigger-upload');
  const extFileUpload = document.getElementById('ext-file-upload');

  if (btnTriggerUpload && extFileUpload) {
    btnTriggerUpload.addEventListener('click', () => {
      extFileUpload.click();
    });

    extFileUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        setLoaderPhase("Compressing uploaded chart image...");
        loaderPanel.style.display = 'block';
        
        const compressedBase64 = await compressFileImage(file);
        loaderPanel.style.display = 'none';
        
        await runAnalysisWithImage(compressedBase64);
      } catch (err) {
        console.error("Failed to process uploaded file:", err);
        alert("Failed to process image: " + err.message);
        loaderPanel.style.display = 'none';
      } finally {
        extFileUpload.value = ''; // Reset file input
      }
    });
  }
});
