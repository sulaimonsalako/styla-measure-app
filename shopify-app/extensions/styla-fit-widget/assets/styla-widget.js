// STYLA Fit Advisor Storefront JavaScript Controller
document.addEventListener('DOMContentLoaded', () => {
  const containers = document.querySelectorAll('.styla-widget-container');
  
  // Setup Supabase Client
  const SUPABASE_URL = "https://tneflxtpmzodauygtslk.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZWZseHRwbXpvZGF1eWd0c2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzA1NTMsImV4cCI6MjA5MzkwNjU1M30.DkzB5-novfMp1IaY4d9710YTv_U7DME3_EC8Jc87MLc";
  
  let supabase = null;
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  containers.forEach(container => {
    const productId = container.getAttribute('data-product-id');
    const productTitle = container.getAttribute('data-product-title');
    const productHandle = container.getAttribute('data-product-handle');
    const customerId = container.getAttribute('data-customer-id');
    const blockId = container.id.replace('styla-widget-', '');
    
    // Core Layout Panels
    const modal = document.getElementById(`styla-modal-${blockId}`);
    const triggerBtn = document.getElementById(`styla-trigger-btn-${blockId}`);
    const closeBtn = document.getElementById(`styla-close-${blockId}`);
    
    const panelLoading = document.getElementById(`styla-panel-loading-${blockId}`);
    const panelAuth = document.getElementById(`styla-panel-auth-${blockId}`);
    const panelResults = document.getElementById(`styla-panel-results-${blockId}`);
    
    const loadingMsgEl = document.getElementById(`styla-loading-msg-${blockId}`);

    // Auth Views
    const authViews = {
      main: document.getElementById(`styla-auth-view-main-${blockId}`),
      scanEmail: document.getElementById(`styla-auth-view-scan-email-${blockId}`),
      retrieve: document.getElementById(`styla-auth-view-retrieve-${blockId}`),
      login: document.getElementById(`styla-auth-view-login-${blockId}`),
      scanner: document.getElementById(`styla-auth-view-3dlook-${blockId}`)
    };

    // State Variables
    let userMeasurements = null;
    let userEmail = "";
    let productSizingInfo = null; // Fetched size chart mapping
    let activeSizeSelected = "M";

    // Standard Default Sizing Templates (Fallback if product is not mapped in dashboard)
    const fallbackSizeCharts = {
      tee: {
        category: 'T-Shirt',
        easeProfile: 'regular',
        sizes: ['S', 'M', 'L', 'XL'],
        chart: {
          'S': { shoulders: 17.5, chest: 19.5, length: 27 },
          'M': { shoulders: 18.5, chest: 21.0, length: 28 },
          'L': { shoulders: 19.5, chest: 23.0, length: 29 },
          'XL': { shoulders: 20.5, chest: 25.0, length: 30 }
        }
      },
      hoodie: {
        category: 'Hoodies',
        easeProfile: 'oversized',
        sizes: ['S', 'M', 'L', 'XL'],
        chart: {
          'S': { shoulders: 19.0, chest: 22.0, length: 27 },
          'M': { shoulders: 20.0, chest: 24.0, length: 28 },
          'L': { shoulders: 21.0, chest: 26.0, length: 29 },
          'XL': { shoulders: 22.0, chest: 28.0, length: 30 }
        }
      },
      jeans: {
        category: 'Jeans',
        easeProfile: 'regular',
        sizes: ['28', '30', '32', '34'],
        chart: {
          '28': { waist: 14.5, hip: 18.5, thigh: 10.0 },
          '30': { waist: 15.5, hip: 19.5, thigh: 10.5 },
          '32': { waist: 16.5, hip: 20.5, thigh: 11.0 },
          '34': { waist: 17.5, hip: 21.5, thigh: 11.5 }
        }
      }
    };

    // Initialize Widget
    initSession();

    // Trigger Open Modal
    triggerBtn.addEventListener('click', () => {
      modal.classList.remove('styla-hidden');
      document.body.style.overflow = 'hidden';
      
      // Fetch current product sizing info from server
      fetchProductSizing().then(() => {
        if (userMeasurements) {
          showPanel('results');
          renderRecommendations();
        } else {
          showPanel('auth');
          showAuthView('main');
        }
      });
    });

    // Close Modal
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    function closeModal() {
      modal.classList.add('styla-hidden');
      document.body.style.overflow = '';
    }

    // Toggle Panels
    function showPanel(panelName) {
      panelLoading.classList.add('styla-hidden');
      panelAuth.classList.add('styla-hidden');
      panelResults.classList.add('styla-hidden');

      if (panelName === 'loading') panelLoading.classList.remove('styla-hidden');
      if (panelName === 'auth') panelAuth.classList.remove('styla-hidden');
      if (panelName === 'results') panelResults.classList.remove('styla-hidden');
    }

    // Toggle Auth Sub-Views
    function showAuthView(viewName) {
      Object.keys(authViews).forEach(k => {
        if (authViews[k]) authViews[k].classList.add('styla-hidden');
      });
      if (authViews[viewName]) authViews[viewName].classList.remove('styla-hidden');
    }

    // Auth Navigation Click Events
    document.getElementById(`btn-auth-start-scan-${blockId}`).addEventListener('click', () => showAuthView('scanEmail'));
    document.getElementById(`btn-auth-goto-retrieve-${blockId}`).addEventListener('click', () => showAuthView('retrieve'));
    document.getElementById(`btn-auth-goto-login-${blockId}`).addEventListener('click', () => showAuthView('login'));

    document.querySelectorAll(`.btn-auth-back-${blockId}`).forEach(btn => {
      btn.addEventListener('click', () => showAuthView('main'));
    });

    document.querySelector(`.btn-auth-cancel-scan-${blockId}`).addEventListener('click', () => {
      // Clear 3DLook MTM integration script if canceled
      const existing = document.getElementById('saia-mtm-integration');
      if (existing) existing.remove();
      const saiaBox = document.getElementById(`saia-widget-container-${blockId}`);
      if (saiaBox) saiaBox.innerHTML = '';
      showAuthView('main');
    });

    // Reset Profile (Logout guest or member session)
    document.getElementById(`styla-profile-reset-${blockId}`).addEventListener('click', async (e) => {
      e.preventDefault();
      localStorage.removeItem('styla_guest_measurements');
      localStorage.removeItem('styla_guest_email');
      userMeasurements = null;
      userEmail = "";
      
      if (supabase) {
        await supabase.auth.signOut();
      }
      
      showPanel('auth');
      showAuthView('main');
    });

    // 1. Session Initialization
    async function initSession() {
      // Check localStorage for Guest Cache
      const guestMeasurements = localStorage.getItem('styla_guest_measurements');
      const guestEmail = localStorage.getItem('styla_guest_email');
      if (guestMeasurements && guestEmail) {
        userMeasurements = JSON.parse(guestMeasurements);
        userEmail = guestEmail;
        console.log("Loaded persistent guest measurements for email:", userEmail);
      }

      // Check Supabase Auth state (Option 2: Cross-site cookie/local state lookup)
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            userEmail = session.user.email;
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile && profile.chest) {
              userMeasurements = profile;
              console.log("Logged-in STYLA member session retrieved:", userEmail);
            }
          }
        } catch (e) {
          console.warn("Supabase member session retrieval error:", e);
        }
      }
    }

    // 2. Fetch Product Sizing Info from Server
    async function fetchProductSizing() {
      if (productSizingInfo) return; // Cached

      try {
        // Query STYLA central products table
        const res = await fetch('https://www.styla.ca/api/store-products');
        if (res.ok) {
          const products = await res.json();
          // Match by handle (normalized to lowercase)
          const matched = products.find(p => p.id === productHandle || p.name.toLowerCase().replace(/\s+/g, '-') === productHandle);
          if (matched && matched.sizeChart && Object.keys(matched.sizeChart).length > 0) {
            productSizingInfo = {
              category: matched.category || 'T-Shirt',
              easeProfile: matched.category.toLowerCase().includes('jean') ? 'regular' : 'regular',
              sizes: matched.sizes || ['S', 'M', 'L'],
              chart: matched.sizeChart
            };
            console.log("Successfully fetched size chart mapping for product:", productHandle);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch product size chart from API. Using fallback template:", err);
      }

      // Fallback templates based on product handle keywords
      const handleLower = productHandle.toLowerCase();
      if (handleLower.includes('jean') || handleLower.includes('pant') || handleLower.includes('trouser')) {
        productSizingInfo = fallbackSizeCharts.jeans;
      } else if (handleLower.includes('hoodie') || handleLower.includes('sweatshirt')) {
        productSizingInfo = fallbackSizeCharts.hoodie;
      } else {
        productSizingInfo = fallbackSizeCharts.tee;
      }
      console.log("Initialized sizing fallback profile:", productSizingInfo.category);
    }

    // 3. Action: Login Member (Option 1)
    document.getElementById(`btn-auth-run-login-${blockId}`).addEventListener('click', async () => {
      const email = document.getElementById(`input-login-email-${blockId}`).value.trim();
      const pass = document.getElementById(`input-login-pass-${blockId}`).value;

      if (!email || !pass) {
        alert("Please enter both email and password.");
        return;
      }

      if (!supabase) {
        alert("Supabase client not initialized.");
        return;
      }

      showPanel('loading');
      loadingMsgEl.textContent = "Signing in to STYLA...";

      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      
      if (error) {
        alert("Login failed: " + error.message);
        showPanel('auth');
        showAuthView('login');
        return;
      }

      // Load profile
      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (pError || !profile || !profile.chest) {
        alert("Welcome, but no sizing scan measurements were found on your profile. Please complete a 3D Scan.");
        showPanel('auth');
        showAuthView('main');
        return;
      }

      userMeasurements = profile;
      userEmail = email;
      showPanel('results');
      renderRecommendations();
    });

    // 4. Action: Retrieve Email scan (Option 3)
    document.getElementById(`btn-auth-run-retrieve-${blockId}`).addEventListener('click', async () => {
      const email = document.getElementById(`input-retrieve-email-${blockId}`).value.trim().toLowerCase();
      if (!email) {
        alert("Please enter a valid email address.");
        return;
      }

      if (!supabase) {
        alert("Database connection offline.");
        return;
      }

      showPanel('loading');
      loadingMsgEl.textContent = "Retrieving scan profile...";

      const { data, error } = await supabase
        .from('store_profiles')
        .select('twin, api_scans')
        .eq('username', email)
        .maybeSingle();

      if (error || !data || !data.twin) {
        alert("No sizing measurements found for this email. Please check the spelling or start a new scan.");
        showPanel('auth');
        showAuthView('retrieve');
        return;
      }

      // Save in localStorage as a guest cache
      localStorage.setItem('styla_guest_measurements', JSON.stringify(data.twin));
      localStorage.setItem('styla_guest_email', email);

      userMeasurements = data.twin;
      userEmail = email;
      showPanel('results');
      renderRecommendations();
    });

    // 5. Action: Launch 3DLook Scanner (Option 3)
    document.getElementById(`btn-auth-launch-scanner-${blockId}`).addEventListener('click', () => {
      const email = document.getElementById(`input-scan-email-${blockId}`).value.trim().toLowerCase();
      if (!email) {
        alert("Please enter your email to continue.");
        return;
      }

      userEmail = email;
      showAuthView('scanner');
      init3DLookWidget(email);
    });

    function init3DLookWidget(email) {
      const saiaBox = document.getElementById(`saia-widget-container-${blockId}`);
      if (saiaBox) saiaBox.innerHTML = '';

      window.MTM_WIDGET_OPTIONS = {
        clientId: email,
        externalId: email,
        client_id: email,
        external_id: email,
        userId: email,
        user_id: email,
        defaultValues: { email: email },
        onMeasurementsReady: (m) => {
          console.log("Shopify MTM callback triggered! Starting poll for:", email);
          
          // Hide scanner widget UI
          const existing = document.getElementById('saia-mtm-integration');
          if (existing) existing.remove();
          if (saiaBox) saiaBox.innerHTML = '';
          
          // Switch to loading animation
          showPanel('loading');
          loadingMsgEl.textContent = "Analyzing scans... Calculating your 80+ tailoring specifications (takes about 15-30s)...";
          
          pollForScanResults(email);
        }
      };

      const script = document.createElement('script');
      script.id = 'saia-mtm-integration';
      script.async = true;
      script.src = 'https://mtm-widget.3dlook.me/integration.js';
      script.setAttribute('data-public-key', 'MTI1OTk:1wbJPG:eHI6-GfRcZPOyHYqxaZ4IUew8jVHXUVPa-W4Ufshk3E');
      script.setAttribute('data-button-title', 'Start Sizing Scan');
      script.setAttribute('data-client-id', email);
      script.setAttribute('data-external-id', email);
      script.setAttribute('data-user-id', email);

      if (saiaBox) {
        saiaBox.appendChild(script);
      }
    }

    // 6. Action: Poll DB for processed results
    function pollForScanResults(email) {
      const startTime = Date.now();
      const timeoutMs = 60000;
      const intervalMs = 3000;

      const intervalId = setInterval(async () => {
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(intervalId);
          showPanel('auth');
          showAuthView('main');
          alert("Scan processing took longer than expected. Sizing details will update automatically soon.");
          return;
        }

        try {
          if (!supabase) return;
          const { data, error } = await supabase
            .from('store_profiles')
            .select('twin')
            .eq('username', email)
            .maybeSingle();

          if (data && data.twin && Object.keys(data.twin).length > 0) {
            clearInterval(intervalId);
            
            // Cache locally
            localStorage.setItem('styla_guest_measurements', JSON.stringify(data.twin));
            localStorage.setItem('styla_guest_email', email);
            
            userMeasurements = data.twin;
            showPanel('results');
            renderRecommendations();
            alert("Scan successful! Sizing recommendation unlocked.");
          }
        } catch (err) {
          console.warn("Polling error:", err);
        }
      }, intervalMs);
    }

    // 7. Styla Fit Engine: Calculate and Render Recommendations
    function renderRecommendations() {
      if (!userMeasurements || !productSizingInfo) return;

      const chart = productSizingInfo.chart;
      const sizes = productSizingInfo.sizes;
      const category = productSizingInfo.category.toLowerCase();
      
      let bestSize = sizes[0];
      let fitOutputs = {};

      // Sizing ease logic re-used from AGENTS.md
      if (category.includes('jean') || category.includes('pant')) {
        // Jeans Sizing Rules
        // Waist ease: target around 0.5" to 1.5" maximum (widths represented flat, flat width * 2 = finished circumference)
        // Hip ease: minimum +2"
        const bodyWaist = Number(userMeasurements.waist) || 30;
        const bodyHips = Number(userMeasurements.hips) || 36;

        sizes.forEach(size => {
          const finishedFlatWaist = Number(chart[size]?.waist || chart[size]?.['waist width (flat)']);
          const finishedFlatHips = Number(chart[size]?.hip || chart[size]?.['hips width (flat)']);

          if (!finishedFlatWaist) return;

          const garmentWaist = finishedFlatWaist * 2;
          const garmentHips = finishedFlatHips * 2;

          const waistEase = garmentWaist - bodyWaist;
          const hipsEase = garmentHips - bodyHips;

          fitOutputs[size] = {
            intent: `Designed to sit securely at your hips. Size ${size} waist is ${garmentWaist.toFixed(1)}" (flat width flat-doubled) compared to your body waist of ${bodyWaist.toFixed(1)}".`,
            measurements: [
              { label: 'Waist', ease: `${waistEase > 0 ? '+' : ''}${waistEase.toFixed(1)}" ease`, badge: (waistEase >= -0.25 && waistEase <= 1.0) ? 'Ideal' : (waistEase > 1.0 ? 'Loose' : 'Tight'), status: (waistEase >= -0.25 && waistEase <= 1.0) ? 'ok' : 'warn' },
              { label: 'Hips', ease: `${hipsEase > 0 ? '+' : ''}${hipsEase.toFixed(1)}" ease`, badge: hipsEase >= 1.5 ? 'Ideal' : 'Tight', status: hipsEase >= 1.5 ? 'ok' : 'err' }
            ]
          };
        });

        // Best Size selector: smallest waist that accommodates hips comfortably (hipsEase >= 0)
        for (let i = 0; i < sizes.length; i++) {
          const s = sizes[i];
          const outputs = fitOutputs[s];
          if (outputs && outputs.measurements[1].status === 'ok') {
            bestSize = s;
            break;
          }
        }
      } else {
        // T-Shirt / Hoodie Sizing Rules
        // Chest ease: +2" Slim, +4" Regular, +8"+ Oversized
        // Shoulders ease: shoulder seam aligns closely (minimum zero ease)
        const bodyChest = Number(userMeasurements.chest) || 38;
        const bodyShoulders = Number(userMeasurements.shoulders) || Number(userMeasurements.shoulder_breadth) || 16.5;

        sizes.forEach(size => {
          const finishedFlatChest = Number(chart[size]?.chest || chart[size]?.['chest width (flat)']);
          // Shoulders are represented directly (not doubled)
          const garmentShoulders = Number(chart[size]?.shoulders || chart[size]?.['shoulder width']);

          if (!finishedFlatChest) return;

          const garmentChest = finishedFlatChest * 2;
          const chestEase = garmentChest - bodyChest;
          const shouldersEase = garmentShoulders - bodyShoulders;

          const designTarget = productSizingInfo.easeProfile === 'oversized' ? 7.0 : 3.0;

          fitOutputs[size] = {
            intent: productSizingInfo.easeProfile === 'oversized' 
              ? `Designed as an "Oversized Fit". Choosing Size ${size} gives a baggy look (+${chestEase.toFixed(1)}" chest ease) and relaxed shoulder seams.`
              : `Designed as a "Regular Fit" style. Size ${size} is optimal for the designer's intended drape.`,
            measurements: [
              { label: 'Shoulders', ease: `${shouldersEase > 0 ? '+' : ''}${shouldersEase.toFixed(1)}" ease`, badge: shouldersEase >= -0.25 ? 'Ideal' : 'Tight', status: shouldersEase >= -0.25 ? 'ok' : 'err' },
              { label: 'Chest', ease: `${chestEase > 0 ? '+' : ''}${chestEase.toFixed(1)}" ease`, badge: chestEase >= designTarget ? 'Ideal' : (chestEase >= 1.5 ? 'Slim' : 'Tight'), status: chestEase >= 1.5 ? 'ok' : 'err' }
            ]
          };
        });

        // Best Size selector: smallest size where both chest and shoulders do not cause errors (status === 'ok')
        for (let i = 0; i < sizes.length; i++) {
          const s = sizes[i];
          const outputs = fitOutputs[s];
          if (outputs && outputs.measurements[0].status === 'ok' && outputs.measurements[1].status === 'ok') {
            bestSize = s;
            break;
          }
        }
      }

      // Populate size options buttons
      const optionsListEl = document.getElementById(`styla-size-options-list-${blockId}`);
      if (optionsListEl) {
        optionsListEl.innerHTML = sizes.map(s => `
          <button type="button" class="styla-size-opt-btn ${s === activeSizeSelected ? 'active' : ''}" data-size="${s}">${s}</button>
        `).join('');

        // Bind size button clicks
        optionsListEl.querySelectorAll('.styla-size-opt-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const size = btn.getAttribute('data-size');
            activeSizeSelected = size;
            updateFitPanel(size, fitOutputs[size]);
          });
        });
      }

      // Slider Clicks
      const prevBtn = document.getElementById(`styla-prev-size-${blockId}`);
      const nextBtn = document.getElementById(`styla-next-size-${blockId}`);

      if (prevBtn) {
        prevBtn.onclick = () => {
          const idx = sizes.indexOf(activeSizeSelected);
          if (idx > 0) {
            activeSizeSelected = sizes[idx - 1];
            updateFitPanel(activeSizeSelected, fitOutputs[activeSizeSelected]);
          }
        };
      }

      if (nextBtn) {
        nextBtn.onclick = () => {
          const idx = sizes.indexOf(activeSizeSelected);
          if (idx < sizes.length - 1) {
            activeSizeSelected = sizes[idx + 1];
            updateFitPanel(activeSizeSelected, fitOutputs[activeSizeSelected]);
          }
        };
      }

      // Default load best option fit panel
      activeSizeSelected = bestSize;
      updateFitPanel(bestSize, fitOutputs[bestSize]);
    }

    function updateFitPanel(size, data) {
      if (!data) return;

      // Update Slider active class
      const optionsListEl = document.getElementById(`styla-size-options-list-${blockId}`);
      if (optionsListEl) {
        optionsListEl.querySelectorAll('.styla-size-opt-btn').forEach(btn => {
          if (btn.getAttribute('data-size') === size) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }

      const bestSizeValEl = document.getElementById(`styla-best-size-val-${blockId}`);
      const intentTextEl = document.getElementById(`styla-intent-text-${blockId}`);
      const listEl = document.getElementById(`styla-text-list-${blockId}`);

      if (bestSizeValEl) bestSizeValEl.textContent = size;
      if (intentTextEl) intentTextEl.textContent = data.intent;

      if (listEl) {
        listEl.innerHTML = data.measurements.map(m => `
          <li class="styla-text-fit-item">
            <span class="styla-item-label">${m.label}</span>
            <span class="styla-item-badge ${m.status}">${m.badge}</span>
            <span class="styla-item-ease">${m.ease}</span>
          </li>
        `).join('');
      }
    }

    // Tabs Switch Logic
    const tabs = modal.querySelectorAll('.styla-tab-btn');
    const tabContents = modal.querySelectorAll('.styla-tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        modal.querySelector(`#${targetId}`).classList.add('active');
      });
    });

    // Ask AI Tailor Chat
    const chatHistory = document.getElementById(`styla-chat-history-${blockId}`);
    const chatInput = document.getElementById(`styla-chat-input-${blockId}`);
    const chatSend = document.getElementById(`styla-chat-send-${blockId}`);

    chatSend.onclick = handleChatSubmit;
    chatInput.onkeypress = (e) => {
      if (e.key === 'Enter') handleChatSubmit();
    };

    function appendMessage(text, type) {
      const bubble = document.createElement('div');
      bubble.className = `chat-msg ${type}`;
      bubble.innerHTML = `<p>${text}</p>`;
      chatHistory.appendChild(bubble);
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function handleChatSubmit() {
      const query = chatInput.value.trim();
      if (!query) return;
      
      appendMessage(query, 'user');
      chatInput.value = '';
      
      setTimeout(() => {
        const response = generateAIResponse(query);
        appendMessage(response, 'system');
      }, 700);
    }

    function generateAIResponse(msg) {
      const text = msg.toLowerCase();
      
      if (text.includes('waist') || text.includes('gap')) {
        const waist = userMeasurements ? Number(userMeasurements.waist) : 30;
        return `Your digital twin waist is **${waist.toFixed(1)}"**. In this size, you'll have comfortable room. Let me know if you want to compare it with other sizing specs!`;
      }
      if (text.includes('stretch') || text.includes('fabric')) {
        return `This item is designed with high quality fabric context mapping. It fits closely based on rigid or slight stretch tolerances configured in the STYLA Fit engine.`;
      }
      return `Based on your digital twin body profile, our AI Tailor recommends sticking to Size ${activeSizeSelected}. It balances comfort and drape. Let me know if you have specific questions about shoulders or chest!`;
    }

  });
});
