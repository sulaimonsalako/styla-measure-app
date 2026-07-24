// DOM Elements
const productsGrid = document.getElementById('products-grid');
const cartBtn = document.getElementById('cart-btn');
const cartCountBadge = document.getElementById('cart-count');
const cartOverlay = document.getElementById('cart-overlay');
const closeCartBtn = document.getElementById('close-cart-btn');

const inviteBanner = document.getElementById('invite-banner');
const creatorNameBanner = document.getElementById('creator-name-banner');
const btnAcceptInvite = document.getElementById('btn-accept-invite');

const statusUnlockedBanner = document.getElementById('status-unlocked-banner');
const statusBannerText = document.getElementById('status-banner-text');

const funnelProgressRatio = document.getElementById('funnel-progress-ratio');
const funnelProgressBar = document.getElementById('funnel-progress-bar');
const funnelMsg = document.getElementById('funnel-msg');
const shareLinkUrl = document.getElementById('share-link-url');
const btnCopyShare = document.getElementById('btn-copy-share');

const creatorCartSection = document.getElementById('creator-cart-section');
const creatorCount = document.getElementById('creator-count');
const creatorCartList = document.getElementById('creator-cart-list');
const friendCartSection = document.getElementById('friend-cart-section');
const friendCount = document.getElementById('friend-count');
const friendCartList = document.getElementById('friend-cart-list');

const cartSubtotal = document.getElementById('cart-subtotal');
const cartShipping = document.getElementById('cart-shipping');
const cartTotal = document.getElementById('cart-total');
const cartSavingsRow = document.getElementById('cart-savings-row');
const cartSavingsAmount = document.getElementById('cart-savings-amount');
const btnCheckoutTrigger = document.getElementById('btn-checkout-trigger');

const detailsModal = document.getElementById('details-modal');
const closeDetailsBtn = document.getElementById('close-details-btn');
const detailsModalContent = document.getElementById('details-modal-content');

const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutBtn = document.getElementById('close-checkout-btn');
const checkoutUnlockedSummary = document.getElementById('checkout-unlocked-summary');

const simAddFriend = document.getElementById('sim-add-friend');
const simResetCart = document.getElementById('sim-reset-cart');

// Authentication & AI Tailor DOM Elements
const loginTriggerBtn = document.getElementById('login-trigger-btn');
const loggedInBox = document.getElementById('logged-in-box');
const twinStatusText = document.getElementById('twin-status');
const twinBtn = document.getElementById('twin-btn');
const logoutBtn = document.getElementById('logout-btn');

const authModal = document.getElementById('auth-modal');
const closeAuthBtn = document.getElementById('close-auth-btn');
const authForm = document.getElementById('auth-form');
const authModalTitle = document.getElementById('auth-modal-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authSwitchText = document.getElementById('auth-switch-text');

const twinModal = document.getElementById('twin-modal');
const closeTwinBtn = document.getElementById('close-twin-btn');
const twinForm = document.getElementById('twin-form');

// Product Ratings & Customer Reviews mock database
const productRatings = {
  "prod_1": { rating: 4.8, count: 84 },
  "prod_2": { rating: 4.7, count: 62 },
  "prod_3": { rating: 4.9, count: 41 },
  "prod_4": { rating: 4.6, count: 95 },
  "prod_5": { rating: 4.8, count: 38 }
};

const mockReviewsData = {
  "prod_1": [
    { author: "Marcus K.", rating: 5, date: "June 2, 2026", text: "Incredibly thick and heavy! The fit is perfect thanks to Styla Auto-Size. Usually I struggle between M and L, but size M was recommended and it fits exactly how I wanted. Zero guesswork." },
    { author: "Elena R.", rating: 5, date: "May 28, 2026", text: "Very soft inside and feels extremely premium. The shoulder drop is just right. Highly recommend completing all optional measurements, the fit accuracy is spot on!" }
  ],
  "prod_2": [
    { author: "Daniel S.", rating: 4, date: "May 30, 2026", text: "The wool material feels premium and flows nicely. Styla recommended size 32 waist and it fits like a glove. Had to get the inseam taken up slightly but the waist is perfect." },
    { author: "Sophia V.", rating: 5, date: "May 25, 2026", text: "Beautiful wide-leg silhouette. Looks highly tailored. The auto-sizing predicted size 30 and it fits comfortably with perfect ease." }
  ],
  "prod_3": [
    { author: "Tyler P.", rating: 5, date: "June 5, 2026", text: "Thick, high quality raw denim. The cropped cut is exactly what I was looking for. Auto-sizing recommended size M and the fit is incredibly comfortable." },
    { author: "Clara T.", rating: 5, date: "May 19, 2026", text: "Solid construction. Perfect vintage charcoal wash. Standard sizes are always tricky for me but Styla locked in the perfect size." }
  ],
  "prod_4": [
    { author: "Jeremy B.", rating: 4, date: "June 8, 2026", text: "The silk blend feels extremely soft and has a nice subtle shine. Fits close to the body. Sizing recommendation was spot on." },
    { author: "Olivia M.", rating: 5, date: "May 12, 2026", text: "Excellent undershirt or standalone piece. Fits perfectly in the shoulders. Styla sizing Twin profile took away all my purchase anxiety." }
  ],
  "prod_5": [
    { author: "Raymond G.", rating: 5, date: "May 15, 2026", text: "Very high quality technical fabric. Completely waterproof and windproof. Recommended size L leaves enough room for layering without looking baggy. Incredible." },
    { author: "Anna F.", rating: 5, date: "May 08, 2026", text: "Looks like a designer coat worth 3 times the price. Perfect drape. Sizing was 100% accurate." }
  ]
};

// Global State
let products = [];
let categories = [];
let currentUser = null; // { username, twin }
let twin = null; // 12-field body measurements
let authMode = 'login'; // 'login' or 'signup'
let cart = {
  id: '',
  creatorItems: [],
  friendItems: [],
  role: 'creator' // 'creator' or 'friend'
};
let hasSimulatedJoin = false;
let simulationTimer = null;

// Initialize App
async function init() {
  loadUserSession();
  await loadProducts();
  await loadCategories();
  parseURLParams();
  setupEventListeners();
  renderProducts();
  updateCartUI();
}

// Load session from Local Storage
function loadUserSession() {
  const savedUser = localStorage.getItem('styla_ps_user');
  const badgeEl = document.getElementById('active-scan-badge');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    
    // Update active scan badge and build twin measurements object
    const activeScan = currentUser.api_scans ? currentUser.api_scans.find(s => s.is_active) : null;
    if (activeScan) {
      if (badgeEl) badgeEl.style.display = 'block';
      twin = {
        chest: activeScan.volume_params.chest,
        waist: activeScan.volume_params.waist,
        belly: activeScan.volume_params.abdomen || activeScan.volume_params.waist,
        hips: activeScan.volume_params.low_hips,
        height: currentUser.twin ? currentUser.twin.height : 64.0,
        shoulder: activeScan.front_params.shoulders,
        sleeve: activeScan.front_params.back_neck_point_to_wrist_length || activeScan.front_params.sleeve_length,
        inseam: activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam,
        neck: activeScan.volume_params.neck,
        thigh: activeScan.volume_params.thigh,
        bicep: activeScan.volume_params.bicep,
        wrist: activeScan.volume_params.wrist,
        length: activeScan.front_params.new_jacket_length || 29.4
      };
    } else {
      if (badgeEl) badgeEl.style.display = 'none';
      twin = currentUser.twin;
    }

    if (currentUser.measurement_overrides) {
      twin = {
        ...twin,
        ...currentUser.measurement_overrides
      };
    }

    // Show logged-in UI
    if (loginTriggerBtn) loginTriggerBtn.classList.add('hidden');
    if (loggedInBox) loggedInBox.classList.remove('hidden');
    if (twinStatusText) twinStatusText.innerText = `@${currentUser.username}`;
    
    // Activate AI Tailor badge color if profile measurements are complete
    if (twin && twin.chest && twin.waist && twin.belly && twin.hips) {
      if (twinBtn) {
        twinBtn.style.backgroundColor = "#16a34a"; // green
        twinBtn.style.borderColor = "#16a34a";
      }
    } else {
      if (twinBtn) {
        twinBtn.style.backgroundColor = "#ff2a75"; // styla pink (incomplete)
        twinBtn.style.borderColor = "#ff2a75";
      }
    }
  } else {
    currentUser = null;
    twin = null;
    if (loginTriggerBtn) loginTriggerBtn.classList.remove('hidden');
    if (loggedInBox) loggedInBox.classList.add('hidden');
    if (badgeEl) badgeEl.style.display = 'none';
    if (twinBtn) {
      twinBtn.style.backgroundColor = "#ff2a75";
      twinBtn.style.borderColor = "#ff2a75";
    }
  }
}

// Fetch products from Vercel API
async function loadProducts() {
  try {
    const res = await fetch('/api/store-products');
    if (!res.ok) throw new Error("Failed to load products");
    products = (await res.json()).filter(p => p.status !== 'paused');
  } catch (err) {
    console.error("Error loading products:", err);
    products = [];
  }
}

// Fetch categories from Vercel API
async function loadCategories() {
  try {
    const res = await fetch('/api/store-categories');
    if (!res.ok) throw new Error("Failed to load categories");
    categories = await res.json();
  } catch (err) {
    console.error("Error loading categories:", err);
    categories = ["Outerwear", "Knitwear", "Shirts", "Pants", "Accessories"];
  }

  const tagsContainer = document.getElementById('tags-categories-container');
  const sidebarContainer = document.getElementById('sidebar-categories-container');

  if (tagsContainer) {
    tagsContainer.innerHTML = `
      <button class="category-tag active" data-cat="all">All</button>
      ${categories.map(cat => `<button class="category-tag" data-cat="${cat}">${cat}</button>`).join('')}
    `;
  }
  if (sidebarContainer) {
    sidebarContainer.innerHTML = `
      <li><a href="#" class="active" data-cat-side="all">All Items</a></li>
      ${categories.map(cat => `<li><a href="#" data-cat-side="${cat}">${cat}</a></li>`).join('')}
    `;
  }
}

// Parse URL for shared carts
async function parseURLParams() {
  const params = new URLSearchParams(window.location.search);
  const urlCartId = params.get('cartId');
  const urlCartState = params.get('cartState');
  const paymentStatus = params.get('payment');
  
  if (paymentStatus === 'success') {
    const rolePaid = params.get('role') || 'creator';
    const amountPaid = parseFloat(params.get('amount')) || 0;
    const paidCartId = params.get('cartId');
    
    // Clear URL parameters to avoid showing receipt again on refresh
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);

    if (paidCartId) {
      // Open modal in success loading state
      if (checkoutModal) checkoutModal.classList.add('open');
      const targetElement = document.getElementById('checkout-unlocked-summary');
      if (targetElement) {
        targetElement.innerHTML = `
          <div class="payment-loader-wrap" style="text-align:center; padding:3rem 0;">
            <div class="payment-spinner"></div>
            <div style="margin-top:1rem; color:var(--text-muted);">Verifying your payment...</div>
          </div>
        `;
      }
      
      // Fetch fresh cart from server
      setTimeout(async () => {
        try {
          const res = await fetch(`/api/store-cart?cartId=${paidCartId}`);
          if (res.ok) {
            const freshCart = await res.json();
            cart = freshCart;
            
            // Webhook fallback: ensure local state reflects the successful payment
            if (rolePaid === 'creator') {
              cart.creatorPaid = true;
            } else if (rolePaid === 'friend') {
              cart.friendPaid = true;
            } else if (rolePaid === 'all') {
              cart.creatorPaid = true;
              cart.friendPaid = true;
            }
            
            // Recompute status based on updated fields
            const hasFriendItems = Array.isArray(cart.friendItems) && cart.friendItems.length > 0;
            if (cart.creatorPaid && (!hasFriendItems || cart.friendPaid)) {
              cart.paymentStatus = 'paid';
            } else if (cart.creatorPaid || cart.friendPaid) {
              cart.paymentStatus = 'partially_paid';
            }
            
            // Sync fallback to server in case webhook is slow
            try {
              await fetch('/api/store-cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: cart.id,
                  creatorItems: cart.creatorItems,
                  friendItems: cart.friendItems,
                  creatorUsername: cart.creatorUsername || undefined,
                  creatorPaid: cart.creatorPaid,
                  friendPaid: cart.friendPaid,
                  paymentStatus: cart.paymentStatus,
                  amountPaid: Number(cart.amountPaid || 0) + amountPaid,
                  creatorMeasurements: twin || undefined
                })
              });
            } catch (syncErr) {
              console.warn("Webhook client-side sync fallback failed:", syncErr);
            }

            localStorage.setItem('styla_ps_cart', JSON.stringify(cart));
            updateCartUI();
            showPaymentSuccess(rolePaid, amountPaid, cart);
          } else {
            throw new Error("Failed to load fresh cart state.");
          }
        } catch (err) {
          if (targetElement) {
            targetElement.innerHTML = `
              <div style="text-align:center; padding:2rem 0;">
                <h2 style="font-family:var(--font-serif); font-size:1.6rem; margin-bottom:0.75rem;">Sync Failed</h2>
                <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:1.5rem;">
                  Your payment was processed, but we couldn't sync the group cart state. Please refresh the page.
                </p>
              </div>
            `;
          }
        }
      }, 1500);
    }
  } else if (paymentStatus === 'cancel') {
    // Clear URL parameters
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);
    alert("Payment checkout was cancelled.");
  }
  
  if (urlCartId) {
    cart.id = urlCartId;
    cart.role = 'friend';
    
    let loadedState = null;
    try {
      const res = await fetch(`/api/store-cart?cartId=${urlCartId}`);
      if (res.ok) {
        loadedState = await res.json();
      }
    } catch (e) {
      console.warn("Failed to fetch cart from server API, falling back to URL decode:", e);
    }
    
    if (!loadedState && urlCartState) {
      try {
        loadedState = JSON.parse(atob(decodeURIComponent(urlCartState)));
      } catch (e) {
        console.error("Error decoding cartState URL param:", e);
      }
    }
    
    if (loadedState) {
      cart.creatorItems = loadedState.creatorItems || [];
      cart.friendItems = loadedState.friendItems || [];
      cart.creatorPaid = loadedState.creatorPaid || false;
      cart.friendPaid = loadedState.friendPaid || false;
      cart.paymentStatus = loadedState.paymentStatus || "unpaid";
      cart.creatorUsername = loadedState.creatorUsername || null;
      
      if (currentUser && loadedState.creatorUsername === currentUser.username) {
        cart.role = "creator";
      } else {
        cart.role = "friend";
      }
      
      localStorage.setItem("styla_ps_cart", JSON.stringify(cart));
      
      inviteBanner.classList.remove("hidden");
      creatorNameBanner.innerText = loadedState.creatorUsername ? `@${loadedState.creatorUsername}` : "a friend";
    }
  } else {
    const savedCart = localStorage.getItem('styla_ps_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        cart = parsed;
        if (!cart.id) cart.id = 'cart_' + Math.random().toString(36).substring(2, 11);
        if (!cart.creatorItems) cart.creatorItems = [];
        if (!cart.friendItems) cart.friendItems = [];
        cart.role = 'creator';
      } catch (e) {
        initializeNewCart();
      }
    } else {
      initializeNewCart();
    }
  }
}

function initializeNewCart() {
  cart = {
    id: 'cart_' + Math.random().toString(36).substring(2, 11),
    creatorItems: [],
    friendItems: [],
    role: 'creator'
  };
  localStorage.setItem('styla_ps_cart', JSON.stringify(cart));
}

// Event Listeners Setup
function setupEventListeners() {
  // 3D Scanner UI event listeners
  const btnAiScan = document.getElementById('btn-ai-scan');
  const scanContainer = document.getElementById('scan-container');
  const btnStartCameraScan = document.getElementById('btn-start-camera-scan');
  const scanSetup = document.getElementById('scan-setup');
  const scanProcessing = document.getElementById('scan-processing');
  const scanTimer = document.getElementById('scan-timer');
  const btnDeactivateScan = document.getElementById('btn-deactivate-scan');

  if (btnAiScan && scanContainer) {
    btnAiScan.addEventListener('click', () => {
      scanContainer.style.display = scanContainer.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (btnStartCameraScan) {
    btnStartCameraScan.addEventListener('click', async () => {
      const gender = document.getElementById('scan-gender').value;
      const weight = document.getElementById('scan-weight').value || 140;

      scanSetup.style.display = 'none';
      scanProcessing.style.display = 'block';

      let count = 3;
      scanTimer.innerText = `Simulating AI camera scan (${count}s)...`;
      
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          scanTimer.innerText = `Simulating AI camera scan (${count}s)...`;
        } else {
          clearInterval(interval);
        }
      }, 1000);

      setTimeout(async () => {
        try {
          const username = currentUser ? currentUser.username : 'guest';
          const initRes = await fetch('/api/3dlook/init-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender, height: 162, weight })
          });
          const session = await initRes.json();
          
          let pollUrl = session.task_set_url;
          
          const statusRes = await fetch(`${pollUrl}&gender=${gender}&height=64&weight=${weight}`);
          const statusData = await statusRes.json();
          
          if (statusData.is_ready && statusData.is_successful) {
            const saveRes = await fetch(`${statusData.redirect_to}&username=${username}`);
            const saveData = await saveRes.json();
            
            if (saveData.success) {
              if (currentUser) {
                currentUser.twin = saveData.twin;
                currentUser.api_scans = saveData.api_scans;
                localStorage.setItem('styla_ps_user', JSON.stringify(currentUser));
              } else {
                const guestUser = {
                  username: 'guest',
                  twin: saveData.twin,
                  api_scans: saveData.api_scans,
                  measurement_overrides: {}
                };
                localStorage.setItem('styla_ps_user', JSON.stringify(guestUser));
              }
              loadUserSession();
              
              // Sync styla_twin_* keys
              localStorage.setItem('styla_twin_chest', saveData.twin.chest);
              localStorage.setItem('styla_twin_waist', saveData.twin.waist);
              localStorage.setItem('styla_twin_belly', saveData.twin.belly || saveData.twin.waist);
              localStorage.setItem('styla_twin_hips', saveData.twin.hips);
              localStorage.setItem('styla_twin_height', '64');
              localStorage.setItem('styla_twin_inseam', saveData.twin.inseam);
              localStorage.setItem('styla_twin_api_scans', JSON.stringify(saveData.api_scans));
              localStorage.removeItem('styla_twin_measurement_overrides');
              
              // Populate fields
              document.getElementById('twin-chest').value = saveData.twin.chest || '';
              document.getElementById('twin-waist').value = saveData.twin.waist || '';
              document.getElementById('twin-hips').value = saveData.twin.hips || '';
              document.getElementById('twin-height-ft').value = '5';
              document.getElementById('twin-height-in').value = '4';
              document.getElementById('twin-inseam').value = saveData.twin.inseam || '';
              document.getElementById('twin-shoulder').value = saveData.twin.shoulder || '';
              document.getElementById('twin-sleeve').value = saveData.twin.sleeve || '';
              document.getElementById('twin-neck').value = saveData.twin.neck || '';
              document.getElementById('twin-thigh').value = saveData.twin.thigh || '';
              document.getElementById('twin-bicep').value = saveData.twin.bicep || '';
              document.getElementById('twin-wrist').value = saveData.twin.wrist || '';
              document.getElementById('twin-length').value = saveData.twin.length || '';

              alert("AI Sizing Scan complete! 80+ measurements imported into your Styla AI Stylist profile.");
              scanContainer.style.display = 'none';
              scanSetup.style.display = 'block';
              scanProcessing.style.display = 'none';
              
              const detailNameEl = detailsModalContent.querySelector('.detail-name');
              if (detailNameEl) {
                const activeProd = products.find(p => p.name === detailNameEl.innerText);
                if (activeProd) {
                  openProductDetails(activeProd.id);
                }
              }
              renderProducts();
              updateCartUI();
            } else {
              throw new Error("Failed to save measurements.");
            }
          } else {
            throw new Error("Scan processing failed.");
          }
        } catch (err) {
          alert("Scanner Error: " + err.message);
          scanSetup.style.display = 'block';
          scanProcessing.style.display = 'none';
        }
      }, 3000);
    });
  }

  if (btnDeactivateScan) {
    btnDeactivateScan.addEventListener('click', async () => {
      if (!currentUser) {
        const savedUser = localStorage.getItem('styla_ps_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed.api_scans) {
            parsed.api_scans.forEach(s => s.is_active = false);
          }
          localStorage.setItem('styla_ps_user', JSON.stringify(parsed));
        }
        localStorage.removeItem('styla_twin_api_scans');
        loadUserSession();
        alert("AI Sizing Scan deactivated.");
        
        const detailNameEl = detailsModalContent.querySelector('.detail-name');
        if (detailNameEl) {
          const activeProd = products.find(p => p.name === detailNameEl.innerText);
          if (activeProd) {
            openProductDetails(activeProd.id);
          }
        }
        renderProducts();
        updateCartUI();
        return;
      }
      if (currentUser.api_scans) {
        currentUser.api_scans.forEach(s => s.is_active = false);
      }
      try {
        const res = await fetch('/api/store-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-profile',
            username: currentUser.username,
            twin: currentUser.twin,
            api_scans: currentUser.api_scans
          })
        });
        if (res.ok) {
          const data = await res.json();
          currentUser.api_scans = data.api_scans;
          localStorage.setItem('styla_ps_user', JSON.stringify(currentUser));
          loadUserSession();
          
          alert("AI Sizing Scan deactivated. Recommendations will now use your manual entry values.");
          
          const detailNameEl = detailsModalContent.querySelector('.detail-name');
          if (detailNameEl) {
            const activeProd = products.find(p => p.name === detailNameEl.innerText);
            if (activeProd) {
              openProductDetails(activeProd.id);
            }
          }
          renderProducts();
          updateCartUI();
        }
      } catch (err) {
        console.error("Failed to deactivate scan:", err);
      }
    });
  }

  document.querySelectorAll('#tags-categories-container button, #sidebar-categories-container a').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = el.getAttribute('data-cat') || el.getAttribute('data-cat-side');
      
      document.querySelectorAll('#tags-categories-container button, #sidebar-categories-container a').forEach(item => {
        const itemCat = item.getAttribute('data-cat') || item.getAttribute('data-cat-side');
        if (itemCat === cat) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
      
      renderProducts(cat);
    });
  });
  
  cartBtn.addEventListener('click', () => cartOverlay.classList.add('open'));
  closeCartBtn.addEventListener('click', () => cartOverlay.classList.remove('open'));
  cartOverlay.addEventListener('click', (e) => {
    if (e.target === cartOverlay) cartOverlay.classList.remove('open');
  });
  
  // Auth Event Listeners & State Machine
function updateAuthModalUI() {
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const switchText = document.getElementById('auth-switch-text');
  const switchBtn = document.getElementById('auth-switch-btn');
  
  const usernameGroup = document.getElementById('auth-username-group');
  const passwordGroup = document.getElementById('auth-password-group');
  const confirmPasswordGroup = document.getElementById('auth-confirm-password-group');
  const codeGroup = document.getElementById('auth-code-group');
  const newPasswordGroup = document.getElementById('auth-new-password-group');
  const forgotTriggerWrap = document.getElementById('auth-forgot-trigger-wrap');
  const switcherWrap = document.getElementById('auth-switcher-wrap');
  const sandboxConsole = document.getElementById('auth-sandbox-console');

  // Reset values and types
  document.querySelectorAll('.password-input-wrap input').forEach(inp => {
    inp.type = 'password';
    inp.value = '';
  });
  document.querySelectorAll('.btn-reveal-pwd').forEach(btn => {
    btn.classList.remove('active');
  });

  // Default hide all groups
  usernameGroup.classList.add('hidden');
  passwordGroup.classList.add('hidden');
  confirmPasswordGroup.classList.add('hidden');
  codeGroup.classList.add('hidden');
  newPasswordGroup.classList.add('hidden');
  forgotTriggerWrap.classList.add('hidden');
  switcherWrap.classList.add('hidden');
  sandboxConsole.classList.add('hidden');
  
  // Set required flags accordingly
  document.getElementById('auth-username').required = false;
  document.getElementById('auth-password').required = false;
  document.getElementById('auth-confirm-password').required = false;
  document.getElementById('auth-reset-code').required = false;
  document.getElementById('auth-new-password').required = false;
  document.getElementById('auth-new-password-confirm').required = false;

  if (authMode === 'login') {
    title.innerText = "Styla Account Login";
    submitBtn.innerText = "Login";
    switchText.innerText = "New to Styla?";
    switchBtn.innerText = "Create an account";
    
    usernameGroup.classList.remove('hidden');
    passwordGroup.classList.remove('hidden');
    forgotTriggerWrap.classList.remove('hidden');
    switcherWrap.classList.remove('hidden');
    
    document.getElementById('auth-username').required = true;
    document.getElementById('auth-password').required = true;
  }
  else if (authMode === 'signup') {
    title.innerText = "Create Styla Account";
    submitBtn.innerText = "Sign Up";
    switchText.innerText = "Already have an account?";
    switchBtn.innerText = "Login";
    
    usernameGroup.classList.remove('hidden');
    passwordGroup.classList.remove('hidden');
    confirmPasswordGroup.classList.remove('hidden');
    switcherWrap.classList.remove('hidden');
    
    document.getElementById('auth-username').required = true;
    document.getElementById('auth-password').required = true;
    document.getElementById('auth-confirm-password').required = true;
  }
  else if (authMode === 'forgot') {
    title.innerText = "Recover Styla Account";
    submitBtn.innerText = "Send Reset Code";
    switchText.innerText = "Remembered your password?";
    switchBtn.innerText = "Login";
    
    usernameGroup.classList.remove('hidden');
    switcherWrap.classList.remove('hidden');
    sandboxConsole.classList.remove('hidden');
    
    document.getElementById('auth-username').required = true;
    sandboxConsole.innerHTML = '<div class="api-log-line info">Simulation System: Verification code will appear here after request.</div>';
  }
  else if (authMode === 'verify-code') {
    title.innerText = "Enter Verification Code";
    submitBtn.innerText = "Verify Code";
    
    codeGroup.classList.remove('hidden');
    sandboxConsole.classList.remove('hidden');
    
    document.getElementById('auth-reset-code').required = true;
  }
  else if (authMode === 'reset-password') {
    title.innerText = "Set New Password";
    submitBtn.innerText = "Save Password";
    
    newPasswordGroup.classList.remove('hidden');
    
    document.getElementById('auth-new-password').required = true;
    document.getElementById('auth-new-password-confirm').required = true;
  }
}

// Wire reveal eye icon handlers
document.querySelectorAll('.btn-reveal-pwd').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const input = btn.previousElementSibling;
    if (input.type === 'password') {
      input.type = 'text';
      btn.classList.add('active');
    } else {
      input.type = 'password';
      btn.classList.remove('active');
    }
  });
});

if (loginTriggerBtn) {
  loginTriggerBtn.addEventListener('click', () => {
    authMode = 'login';
    updateAuthModalUI();
    authModal.classList.add('open');
  });
}

if (closeAuthBtn) {
  closeAuthBtn.addEventListener('click', () => authModal.classList.remove('open'));
}

if (authSwitchBtn) {
  authSwitchBtn.addEventListener('click', () => {
    if (authMode === 'login' || authMode === 'forgot') {
      authMode = 'signup';
    } else {
      authMode = 'login';
    }
    updateAuthModalUI();
  });
}

const forgotBtn = document.getElementById('auth-forgot-trigger-btn');
if (forgotBtn) {
  forgotBtn.addEventListener('click', () => {
    authMode = 'forgot';
    updateAuthModalUI();
  });
}

if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('auth-username').value.trim();
    
    if (authMode === 'login') {
      const password = document.getElementById('auth-password').value;
      try {
        const res = await fetch('/api/store-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', username, password })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Authentication failed.");
        }
        const data = await res.json();
        currentUser = { username: data.username, twin: data.twin };
        localStorage.setItem("styla_ps_user", JSON.stringify(currentUser));
        loadUserSession();
        authModal.classList.remove("open");
        alert(`Logged in successfully as @${currentUser.username}!`);
        if (cart.role === "creator") {
          cart.creatorUsername = currentUser.username;
          saveCartAndSync();
        }
        renderProducts();
        updateCartUI();
      } catch (err) {
        alert("Login Error: " + err.message);
      }
    }
    else if (authMode === 'signup') {
      const password = document.getElementById('auth-password').value;
      const confirmPassword = document.getElementById('auth-confirm-password').value;
      
      if (password !== confirmPassword) {
        alert("Validation Error: Passwords do not match.");
        return;
      }

      let guestTwin = null;
      let guestScans = [];
      let guestOverrides = {};
      let guestManual = {};
      try {
        const savedUser = localStorage.getItem('styla_ps_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed.username === 'guest') {
            guestTwin = parsed.twin;
            guestScans = parsed.api_scans || [];
            guestOverrides = parsed.measurement_overrides || {};
            guestManual = parsed.manual_measurements || {};
          }
        }
      } catch (e) {}
      
      try {
        const res = await fetch('/api/store-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'signup',
            username,
            password,
            twin: guestTwin,
            api_scans: guestScans,
            measurement_overrides: guestOverrides,
            manual_measurements: guestManual
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Signup failed.");
        }
        const data = await res.json();
        currentUser = { 
          username: data.username, 
          twin: data.twin || guestTwin,
          api_scans: data.api_scans || guestScans,
          measurement_overrides: data.measurement_overrides || guestOverrides,
          manual_measurements: data.manual_measurements || guestManual
        };
        localStorage.setItem("styla_ps_user", JSON.stringify(currentUser));
        loadUserSession();
        authModal.classList.remove("open");
        alert(`Account created successfully! Welcome @${currentUser.username}!`);
        if (cart.role === "creator") {
          cart.creatorUsername = currentUser.username;
          saveCartAndSync();
        }
        renderProducts();
        updateCartUI();
      } catch (err) {
        alert("Signup Error: " + err.message);
      }
    }
    else if (authMode === 'forgot') {
      const consoleLog = document.getElementById('auth-sandbox-console');
      consoleLog.innerHTML = '<div class="api-log-line info">[SYS] Sending reset request...</div>';
      
      try {
        const res = await fetch('/api/store-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'forgot-password', username })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Reset request failed.");
        }
        const data = await res.json();
        
        consoleLog.innerHTML = `
          <div class="api-log-line info">[SYS] Reset request processed successfully.</div>
          <div class="api-log-line info">[MAIL] Delivery simulation successful.</div>
          <div class="api-log-line" style="color:#4ade80; font-weight:700;">[INBOX] Click or copy code: ${data.code}</div>
        `;
        
        alert("Reset Code Sent! Please read the green console box in the modal to retrieve the simulation code.");
        
        authMode = 'verify-code';
        updateAuthModalUI();
        
        document.getElementById('auth-sandbox-console').innerHTML = consoleLog.innerHTML;
        authForm.setAttribute('data-temp-username', username);
      } catch (err) {
        consoleLog.innerHTML = `<div class="api-log-line error">[ERR] ${err.message}</div>`;
        alert("Forgot Password Error: " + err.message);
      }
    }
    else if (authMode === 'verify-code') {
      const code = document.getElementById('auth-reset-code').value.trim();
      if (code.length !== 6) {
        alert("Validation Error: Verification code must be 6 digits.");
        return;
      }
      authForm.setAttribute('data-temp-code', code);
      authMode = 'reset-password';
      updateAuthModalUI();
    }
    else if (authMode === 'reset-password') {
      const tempUsername = authForm.getAttribute('data-temp-username');
      const tempCode = authForm.getAttribute('data-temp-code');
      const newPassword = document.getElementById('auth-new-password').value;
      const newPasswordConfirm = document.getElementById('auth-new-password-confirm').value;
      
      if (newPassword !== newPasswordConfirm) {
        alert("Validation Error: New passwords do not match.");
        return;
      }
      
      try {
        const res = await fetch('/api/store-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset-password',
            username: tempUsername,
            code: tempCode,
            newPassword
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Password reset failed.");
        }
        
        alert("Password reset successfully! You can now login with your new password.");
        authMode = 'login';
        updateAuthModalUI();
      } catch (err) {
        alert("Reset Password Error: " + err.message);
      }
    }
  });
}

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to log out?")) {
        localStorage.removeItem('styla_ps_user');
        currentUser = null;
        twin = null;
        loadUserSession();
        alert("Logged out successfully.");
        renderProducts();
        updateCartUI();
      }
    });
  }
  
  // AI Tailor modal events
  if (twinBtn) {
    twinBtn.addEventListener('click', () => {
      // Populate form values if twin exists
      if (twin) {
        document.getElementById('twin-chest').value = twin.chest || '';
        document.getElementById('twin-waist').value = twin.waist || '';
        document.getElementById('twin-belly').value = twin.belly || '';
        document.getElementById('twin-hips').value = twin.hips || '';
        if (twin.height) {
        const ft = Math.floor(twin.height / 12);
        const inch = Math.round(twin.height % 12);
        document.getElementById('twin-height-ft').value = ft || '';
        document.getElementById('twin-height-in').value = inch !== undefined ? inch : '';
      } else {
        document.getElementById('twin-height-ft').value = '';
        document.getElementById('twin-height-in').value = '';
      }
        document.getElementById('twin-shoulder').value = twin.shoulder || '';
        document.getElementById('twin-sleeve').value = twin.sleeve || '';
        document.getElementById('twin-inseam').value = twin.inseam || '';
        document.getElementById('twin-neck').value = twin.neck || '';
        document.getElementById('twin-thigh').value = twin.thigh || '';
        document.getElementById('twin-bicep').value = twin.bicep || '';
        document.getElementById('twin-wrist').value = twin.wrist || '';
        document.getElementById('twin-length').value = twin.length || '';
      }
      twinModal.classList.add('open');
    });
  }
  
  if (closeTwinBtn) {
    closeTwinBtn.addEventListener('click', () => twinModal.classList.remove('open'));
  }
  
  if (twinForm) {
    twinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      


      if (!currentUser) {
        // Guest mode: save to guest session
        const guestUser = {
          username: 'guest',
          twin: newTwin,
          api_scans: [],
          measurement_overrides: {}
        };
        localStorage.setItem('styla_ps_user', JSON.stringify(guestUser));
        loadUserSession();
        
        // Sync styla_twin_* keys for bookmarklet & extension compatibility
        localStorage.setItem('styla_twin_chest', chest.toString());
        localStorage.setItem('styla_twin_waist', waist.toString());
        localStorage.setItem('styla_twin_belly', belly.toString());
        localStorage.setItem('styla_twin_hips', hips.toString());
        localStorage.setItem('styla_twin_height', height.toString());
        localStorage.setItem('styla_twin_inseam', inseam.toString());
        localStorage.removeItem('styla_twin_api_scans');
        localStorage.removeItem('styla_twin_measurement_overrides');

        alert("Twin measurements saved to browser locally! Sizing suggestions are now active.");
        twinModal.classList.remove('open');
        
        const detailNameEl = detailsModalContent.querySelector('.detail-name');
        if (detailNameEl) {
          const activeProd = products.find(p => p.name === detailNameEl.innerText);
          if (activeProd) {
            openProductDetails(activeProd.id);
          }
        }
        renderProducts();
        updateCartUI();
        return;
      }

      const getVal = (id) => {
        const val = document.getElementById(id).value;
        return val ? Number(val) : null;
      };

      const chest = Number(document.getElementById('twin-chest').value);
      const waist = Number(document.getElementById('twin-waist').value);
      const belly = Number(document.getElementById('twin-belly').value);
      const hips = Number(document.getElementById('twin-hips').value);
      const heightFt = Number(document.getElementById('twin-height-ft').value);
      const heightIn = Number(document.getElementById('twin-height-in').value);
      const height = (heightFt * 12) + heightIn;
      const inseam = Number(document.getElementById('twin-inseam').value);
      
      const shoulder = getVal('twin-shoulder');
      const sleeve = getVal('twin-sleeve');
      const neck = getVal('twin-neck');
      const thigh = getVal('twin-thigh');
      const bicep = getVal('twin-bicep');
      const wrist = getVal('twin-wrist');
      const length = getVal('twin-length');
      
      const newTwin = { chest, waist, belly, hips, height, shoulder, sleeve, inseam, neck, thigh, bicep, wrist, length };
      
      try {
        const res = await fetch('/api/store-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-profile',
            username: currentUser.username,
            twin: newTwin
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to save profile.");
        }

        const data = await res.json();
        currentUser.twin = data.twin;
        localStorage.setItem('styla_ps_user', JSON.stringify(currentUser));
        loadUserSession();
        
        twinModal.classList.remove('open');
        alert("Sizing profile twin updated! Recommendations will align to these metrics.");
        
        // Refresh product details popup if open
        const detailNameEl = detailsModalContent.querySelector('.detail-name');
        if (detailNameEl) {
          const activeProd = products.find(p => p.name === detailNameEl.innerText);
          if (activeProd) {
            openProductDetails(activeProd.id);
          }
        }
        renderProducts();
        updateCartUI();
      } catch (err) {
        alert("Error saving profile: " + err.message);
      }
    });
  }

  btnAcceptInvite.addEventListener('click', () => {
    inviteBanner.classList.add('hidden');
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);
  });
  
  btnCopyShare.addEventListener('click', () => {
    navigator.clipboard.writeText(shareLinkUrl.innerText)
      .then(() => {
        btnCopyShare.innerText = "COPIED!";
        setTimeout(() => { btnCopyShare.innerText = "COPY LINK"; }, 2000);
      })
      .catch(err => {
        console.error("Could not copy share link:", err);
      });
  });
  
  btnCheckoutTrigger.addEventListener('click', async () => {
    cartOverlay.classList.remove('open');
    
    // Fetch latest cart state from server
    if (cart.id) {
      try {
        const res = await fetch(`/api/store-cart?cartId=${cart.id}`);
        if (res.ok) {
          const loadedCart = await res.json();
          cart.creatorPaid = loadedCart.creatorPaid || false;
          cart.friendPaid = loadedCart.friendPaid || false;
          cart.paymentStatus = loadedCart.paymentStatus || 'unpaid';
          cart.creatorUsername = loadedCart.creatorUsername || null;
          cart.creatorItems = loadedCart.creatorItems || [];
          cart.friendItems = loadedCart.friendItems || [];
          localStorage.setItem('styla_ps_cart', JSON.stringify(cart));
        } else if (res.status === 404) {
          // If the cart doesn't exist on the server (e.g. recycled /tmp), sync it now
          await saveCartAndSync();
        }
      } catch (e) {
        console.warn("Failed to fetch fresh cart state before checkout:", e);
      }
    }
    
    renderCheckoutSummary();
    checkoutModal.classList.add('open');
  });
  closeCheckoutBtn.addEventListener('click', () => checkoutModal.classList.remove('open'));
  
  closeDetailsBtn.addEventListener('click', () => detailsModal.classList.remove('open'));
  
  simAddFriend.addEventListener('click', simulateFriendAddingItems);
  simResetCart.addEventListener('click', () => {
    localStorage.removeItem('styla_ps_cart');
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);
    initializeNewCart();
    updateCartUI();
    inviteBanner.classList.add('hidden');
    
    // Reset simulation variables
    hasSimulatedJoin = false;
    if (simulationTimer) clearTimeout(simulationTimer);
    const hud = document.getElementById('co-shopping-hud');
    if (hud) {
      hud.classList.add('hidden');
      hud.classList.remove('closed-manually');
    }
    
    alert("Group Cart has been reset.");
  });

  // Co-Shopping Hero Header live copy listener
  const btnCoHeroCopy = document.getElementById('btn-co-hero-copy');
  if (btnCoHeroCopy) {
    btnCoHeroCopy.addEventListener('click', () => {
      const coHeroUrl = document.getElementById('co-hero-share-url');
      if (coHeroUrl && coHeroUrl.value !== 'Add items to generate link...') {
        navigator.clipboard.writeText(coHeroUrl.value)
          .then(() => {
            btnCoHeroCopy.innerText = "Copied!";
            setTimeout(() => { btnCoHeroCopy.innerText = "Copy Live Link"; }, 2000);
          })
          .catch(err => {
            console.error("Could not copy share link:", err);
          });
      } else {
        alert("Please add items to your cart first to generate a live link!");
      }
    });
  }

  // Floating Co-Shopping HUD Event Listeners
  const btnHudClose = document.getElementById('btn-hud-close-sim');
  if (btnHudClose) {
    btnHudClose.addEventListener('click', () => {
      const hud = document.getElementById('co-shopping-hud');
      if (hud) {
        hud.classList.add('hidden');
        hud.classList.add('closed-manually');
      }
    });
  }
  
  const btnHudShare = document.getElementById('btn-hud-share');
  if (btnHudShare) {
    btnHudShare.addEventListener('click', () => {
      const coHeroUrl = document.getElementById('co-hero-share-url');
      if (coHeroUrl && coHeroUrl.value !== 'Add items to generate link...') {
        navigator.clipboard.writeText(coHeroUrl.value)
          .then(() => {
            btnHudShare.innerText = "Link Copied! \uD83D\uDC65";
            setTimeout(() => { btnHudShare.innerText = "\uD83D\uDC65 Invite Friend to Shop"; }, 2000);
          })
          .catch(err => console.error(err));
      } else {
        alert("Please add items to your cart first to share!");
      }
    });
  }
}

// Normalize size chart columns to AI Tailor metrics keys
function normalizeMeasurementKey(key) {
  const k = key.toLowerCase();
  if (k.includes('chest') || k.includes('bust')) return 'chest';
  if (k.includes('belly') || k.includes('abdomen') || k.includes('midsection')) return 'belly';
  if (k.includes('waist')) return 'waist';
  if (k.includes('hip')) return 'hips';
  if (k.includes('shoulder')) return 'shoulder';
  if (k.includes('sleeve')) return 'sleeve';
  if (k.includes('inseam')) return 'inseam';
  if (k.includes('neck') || k.includes('collar')) return 'neck';
  if (k.includes('thigh')) return 'thigh';
  if (k.includes('bicep') || k.includes('upper arm')) return 'bicep';
  if (k.includes('wrist') || k.includes('cuff')) return 'wrist';
  if (k.includes('length') || k.includes('torso') || k.includes('back length')) return 'length';
  return null;
}

// Styla Sizing Algorithm (Body to Dynamic Garment Matching)
function getRecommendedSize(product, bodyMeasurements) {
  if (!product.sizeChart || Object.keys(product.sizeChart).length === 0) {
    return { size: product.sizes[0], fitNotes: 'Garment specs not uploaded yet. True to size.' };
  }

  const chart = product.sizeChart;
  const availableSizes = Object.keys(chart);
  
  // Fabric-specific stretch allowances (how much larger user body can be than brand body spec)
  let allowance = 0.5; // Default for woven/structured/default
  let maxNegativeDiff = -2.5; // Default max looseness (brand spec is too large)

  const category = (product.category || '').toLowerCase();
  if (category.includes('knit') || category.includes('sweater') || category.includes('hoodie') || category.includes('tee') || category.includes('shirt')) {
    allowance = 1.5;
    maxNegativeDiff = -4.0;
  }
  if (category.includes('spandex') || category.includes('activewear') || category.includes('legging')) {
    allowance = 3.0;
    maxNegativeDiff = -1.0;
  }
  if (category.includes('pant') || category.includes('trouser') || category.includes('short')) {
    maxNegativeDiff = -1.5;
  }

  let bestSize = null;
  let bestScore = Infinity;
  const sizeMatches = [];

  for (const sz of availableSizes) {
    const specs = chart[sz];
    let isCompatible = true;
    let totalAbsDiff = 0;
    let matchCount = 0;
    const fitNotesList = [];

    // Check all specs available for this size
    for (const pomName of Object.keys(specs)) {
      const brandValue = Number(specs[pomName]);
      const bodyKey = normalizeMeasurementKey(pomName);
      
      if (bodyKey && bodyMeasurements[bodyKey] !== undefined) {
        const bodyValue = Number(bodyMeasurements[bodyKey]);
        const diff = bodyValue - brandValue; // positive means user body is larger than brand spec, negative means smaller
        
        // Sizing compatibility rules
        if (bodyKey === 'chest' || bodyKey === 'waist' || bodyKey === 'belly' || bodyKey === 'hips' || bodyKey === 'neck' || bodyKey === 'thigh' || bodyKey === 'bicep' || bodyKey === 'wrist') {
          if (diff > allowance) {
            isCompatible = false;
          }
          if (diff < maxNegativeDiff) {
            isCompatible = false;
          }
          
          // Belly Sizing Proxy: check waist on non-pants to make sure it accommodates user's belly
          if (bodyKey === 'waist' && !category.includes('pant') && !category.includes('trouser') && !category.includes('short') && bodyMeasurements.belly !== undefined) {
            const bellyValue = Number(bodyMeasurements.belly);
            const bellyDiff = bellyValue - brandValue;
            if (bellyDiff > allowance) {
              isCompatible = false;
            }
          }

          fitNotesList.push(`${pomName} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}" diff)`);
        } else if (bodyKey === 'shoulder') {
          if (diff > allowance) {
            isCompatible = false;
          }
          fitNotesList.push(`${pomName} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}" diff)`);
        } else if (bodyKey === 'sleeve') {
          if (diff < -2.0 || diff > 2.0) {
            isCompatible = false;
          }
          fitNotesList.push(`${pomName} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}" sleeve diff)`);
        } else if (bodyKey === 'inseam') {
          if (diff < -2.0 || diff > 2.0) {
            isCompatible = false;
          }
          fitNotesList.push(`${pomName} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}" inseam diff)`);
        } else if (bodyKey === 'length') {
          if (diff < -3.0 || diff > 3.0) {
            isCompatible = false;
          }
          fitNotesList.push(`${pomName} (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}" length diff)`);
        }

        totalAbsDiff += Math.abs(diff);
        matchCount += 1;
      }
    }

    if (isCompatible && matchCount > 0) {
      const score = totalAbsDiff / matchCount;
      sizeMatches.push({
        size: sz,
        score: score,
        notes: fitNotesList.join(', ')
      });
    }
  }

  if (sizeMatches.length > 0) {
    sizeMatches.sort((a, b) => a.score - b.score);
    bestSize = sizeMatches[0].size;
    return { size: bestSize, fitNotes: sizeMatches[0].notes };
  }

  const largestSize = availableSizes[availableSizes.length - 1];
  return { 
    size: largestSize, 
    fitNotes: `No size fits comfortably. Size ${largestSize} is recommended for tight fit.` 
  };
}

// Render Products Grid
function renderProducts(categoryFilter = 'all') {
  let filtered = products;
  if (categoryFilter && categoryFilter !== 'all') {
    filtered = products.filter(p => p.category === categoryFilter);
  }

  if (filtered.length === 0) {
    productsGrid.innerHTML = '<div class="no-items" style="grid-column: span 3; text-align: center; padding: 3rem;">No products found in this category.</div>';
    return;
  }

  const totalQty = getCartTotalQuantity();
  const isUnlocked = totalQty >= 4;

  productsGrid.innerHTML = filtered.map(prod => {
    const ratingInfo = productRatings[prod.id] || { rating: 5.0, count: 1 };
    const fullStars = Math.floor(ratingInfo.rating);
    const emptyStars = 5 - fullStars;
    const starsStr = '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
    
    return `
    <article class="product-card" data-id="${prod.id}">
      <div class="product-img-wrapper">
        <div class="product-badge-group">
          <span class="badge-bulk" style="background:#10b981; color:#fff; font-size:0.65rem;">VIP Group Price: $${prod.bulkPrice}</span>
        </div>
        <img class="product-img" src="${prod.images && prod.images[0] ? prod.images[0] : 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop'}" alt="${prod.name}">
        <div class="product-card-overlay">
          <button class="btn-quick-add" data-id="${prod.id}">Quick View</button>
        </div>
      </div>
      <div class="product-info">
        <h3 class="prod-title">${prod.name}</h3>
        <div class="catalog-rating-row">
          <span style="letter-spacing:1px;">${starsStr}</span>
          <span style="font-weight:700; color:#3f3f46; margin-left:4px;">${ratingInfo.rating}</span>
          <span class="catalog-rating-count">(${ratingInfo.count})</span>
        </div>
        <div class="catalog-price-row">
          <div style="display:flex; flex-direction:column; align-items:flex-start;">
            <span class="catalog-single-price">Single: $${prod.singlePrice}</span>
          </div>
          <div class="catalog-vip-price-container">
            <span class="catalog-vip-price">$${prod.bulkPrice}</span>
            <span class="catalog-vip-label">VIP Group Price</span>
          </div>
        </div>
      </div>
    </article>
  `}).join('');

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-quick-add')) return;
      const id = card.getAttribute('data-id');
      openProductDetails(id);
    });
  });

  document.querySelectorAll('.btn-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openProductDetails(id);
    });
  });
}

function openProductDetails(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  const initialColor = (prod.colors && prod.colors.length > 0) ? prod.colors[0] : 'Standard';
  const initialImages = (prod.colorImages && prod.colorImages[initialColor] && prod.colorImages[initialColor].length > 0)
    ? prod.colorImages[initialColor]
    : prod.images;

  // Sizing display logic based on AI Tailor profile status
  let sizingPanelHtml = '';
  let autoSizeValue = '';
  
  if (twin) {
    const recommended = getRecommendedSize(prod, twin);
    autoSizeValue = recommended.size;
    
    sizingPanelHtml = `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 1.25rem; margin-bottom: 1.5rem; text-align: left; font-size: 0.85rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span style="color: #16a34a; font-weight: 700; letter-spacing:0.05em;">✨ STYLA AUTO-SIZE RECOMMENDED</span>
          <span style="font-family:var(--font-mono); font-weight:700; font-size:1.1rem; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:4px;">Size: ${recommended.size}</span>
        </div>
        <p style="color: #15803d; line-height:1.4;">
          Your AI Tailor sizing profile determines **Garment Size ${recommended.size}** is the best match.
        </p>
        <p style="font-size:0.75rem; color:#166534; font-style:italic; margin-top:4px;">
          Fit details: ${recommended.fitNotes}
        </p>
        <button id="btn-override-sizing" style="background:none; border:none; color:#16a34a; font-size:0.7rem; text-decoration:underline; font-weight:700; margin-top:8px; cursor:pointer; padding:0; display:block;">
          Override Sizing Recommendation
        </button>
      </div>
      
      <!-- Hidden sizes selector box to prevent manual select confusion -->
      <div class="detail-sizes-box hidden" id="sizes-override-box" style="margin-bottom: 2rem;">
        <h4 class="size-select-title">CHOOSE ALTERNATIVE SIZE</h4>
        <div class="size-buttons">
          ${prod.sizes.map(size => `
            <button class="size-btn ${size === recommended.size ? 'active' : ''}" data-size="${size}">${size}</button>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    // No twin active - prompt setups
    sizingPanelHtml = `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; text-align: left; font-size: 0.8rem; color:#b45309; line-height:1.4;">
        <strong>Sizing Guesswork Alert:</strong> Please <strong>Login or Signup</strong> to setup your sizing profile. Styla will automatically lock your size from China manufacturers.
        <button id="btn-modal-twin-setup" style="background:none; border:none; text-decoration:underline; font-weight:700; color:#854d0e; cursor:pointer; margin-left:4px; padding:0;">Login now</button>
      </div>
      
      <div class="detail-sizes-box" style="margin-bottom: 2rem;">
        <h4 class="size-select-title">SELECT SIZE (MANUAL OVERRIDE)</h4>
        <div class="size-buttons">
          ${prod.sizes.map((size, idx) => `
            <button class="size-btn ${idx === 0 ? 'active' : ''}" data-size="${size}">${size}</button>
          `).join('')}
        </div>
      </div>
    `;
  }

  const ratingInfo = productRatings[prod.id] || { rating: 5.0, count: 1 };
  const fullStars = Math.floor(ratingInfo.rating);
  const emptyStars = 5 - fullStars;
  const starsStr = '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
  const ratingSummaryHtml = `
    <div class="detail-rating-row">
      <span style="letter-spacing:1px; font-size:1rem;">${starsStr}</span>
      <span style="font-weight:700; color:#18181b;">${ratingInfo.rating}</span>
      <span class="detail-rating-count">(${ratingInfo.count} Customer Reviews)</span>
    </div>
  `;

  const reviews = mockReviewsData[prod.id] || [];
  const reviewsHtml = `
    <div class="reviews-section">
      <h3 class="reviews-title">Customer Reviews</h3>
      <div class="reviews-list">
        ${reviews.map(rev => `
          <div class="review-card">
            <div class="review-header">
              <div class="review-author-rating">
                <span class="review-author">${rev.author}</span>
                <span class="review-stars">${'★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating)}</span>
              </div>
              <span class="review-date">${rev.date}</span>
            </div>
            <p class="review-text">${rev.text}</p>
            <div class="review-verified-badge">
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20" style="vertical-align:middle; margin-right:3px;"><path fill-rule="evenodd" d="M6.267 3.455a.75.75 0 00-.708-.523H4.5a2.5 2.5 0 00-2.5 2.5v1.07a.75.75 0 00.523.708 6.969 6.969 0 004.832 0 .75.75 0 00.523-.708V5.432a.75.75 0 00-.111-.383l-1-1.587zm1.096 11.233a.75.75 0 00-.708-.523H5.625a2.5 2.5 0 00-2.5 2.5v1.07c0 .324.208.611.523.708a6.97 6.97 0 004.832 0 .75.75 0 00.523-.708v-1.07a.75.75 0 00-.111-.383l-1-1.587z" clip-rule="evenodd"></path></svg>
              Verified Purchase & Size Lock
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  detailsModalContent.innerHTML = `
    <div class="detail-layout">
      <!-- Images section -->
      <div class="detail-img-section">
        <div class="main-img-wrap">
          <img id="detail-main-img" src="${initialImages && initialImages[0] ? initialImages[0] : 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop'}" alt="${prod.name}">
        </div>
        <div class="thumbnails-strip">
          ${initialImages && initialImages.length > 1 ? initialImages.map((img, index) => `
            <div class="thumb-wrap ${index === 0 ? 'active' : ''}" data-index="${index}">
              <img src="${img}" alt="${prod.name} thumbnail ${index + 1}">
            </div>
          `).join('') : ''}
        </div>
      </div>

      <!-- Information section -->
      <div class="detail-info-section">
        <!-- supplier hidden -->
        <h2 class="detail-name">${prod.name}</h2>
        ${ratingSummaryHtml}
        <p class="detail-desc">${prod.description || 'No description available for this item.'}</p>
        
        <div class="detail-pricing-card">
          <div class="detail-price-item">
            <span class="detail-price-label">Single Shipping Price:</span>
            <span class="detail-price-val">$${prod.singlePrice}</span>
          </div>
          <div class="detail-price-item">
            <span class="detail-price-label">VIP Group Price:</span>
            <span class="detail-price-val bulk">$${prod.bulkPrice}</span>
          </div>
        </div>

        <!-- Color Variations Selector -->
        <div class="detail-colors-box" style="margin-bottom: 1.25rem;">
          <h4 class="size-select-title">SELECT COLOR</h4>
          <div class="color-buttons" style="display:flex; gap:8px;">
            ${prod.colors && prod.colors.length > 0 ? prod.colors.map((color, idx) => `
              <button class="color-btn ${idx === 0 ? 'active' : ''}" data-color="${color}">${color}</button>
            `).join('') : '<button class="color-btn active" data-color="Standard">Standard</button>'}
          </div>
        </div>

        <!-- Sizing Panel (Dynamic Sizing Recommendations) -->
        <div id="sizing-recommendation-panel">
          ${sizingPanelHtml}
        </div>

        <button class="btn-add-to-cart" id="btn-add-details">ADD TO BATCH CART</button>
      </div>
      
      <!-- Customer Reviews -->
      ${reviewsHtml}
    </div>
  `;

  // Bind size controls
  const bindSizingButtons = () => {
    const sizeBtns = detailsModalContent.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  };
  
  bindSizingButtons();

  // Override click handler
  const btnOverride = detailsModalContent.querySelector('#btn-override-sizing');
  if (btnOverride) {
    btnOverride.addEventListener('click', () => {
      const overrideBox = detailsModalContent.querySelector('#sizes-override-box');
      if (overrideBox) {
        overrideBox.classList.remove('hidden');
        btnOverride.style.display = 'none'; // hide override trigger
      }
    });
  }

  // Bind setup twin click handler
  const btnTwinSetup = detailsModalContent.querySelector('#btn-modal-twin-setup');
  if (btnTwinSetup) {
    btnTwinSetup.addEventListener('click', () => {
      detailsModal.classList.remove('open');
      loginTriggerBtn.click(); // Open login modal
    });
  }

  // Bind color & gallery controls
  const colorBtns = detailsModalContent.querySelectorAll('.color-btn');
  const mainImg = detailsModalContent.querySelector('#detail-main-img');
  const thumbsContainer = detailsModalContent.querySelector('.thumbnails-strip');

  const updateGallery = (images) => {
    if (!mainImg) return;
    if (images && images.length > 0) {
      mainImg.src = images[0];
    } else {
      mainImg.src = 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop';
    }
    
    if (!thumbsContainer) return;
    if (images && images.length > 1) {
      thumbsContainer.innerHTML = images.map((img, index) => `
        <div class="thumb-wrap ${index === 0 ? 'active' : ''}" data-index="${index}">
          <img src="${img}" alt="${prod.name} thumbnail ${index + 1}">
        </div>
      `).join('');
      
      const thumbs = thumbsContainer.querySelectorAll('.thumb-wrap');
      thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
          thumbs.forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          const idx = parseInt(thumb.getAttribute('data-index'), 10);
          mainImg.src = images[idx];
        });
      });
    } else {
      thumbsContainer.innerHTML = '';
    }
  };

  // Bind initial thumbnails click handler if there are any
  if (initialImages && initialImages.length > 1) {
    const thumbs = thumbsContainer.querySelectorAll('.thumb-wrap');
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        const idx = parseInt(thumb.getAttribute('data-index'), 10);
        mainImg.src = initialImages[idx];
      });
    });
  }

  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const selectedColor = btn.getAttribute('data-color');
      const colorImages = (prod.colorImages && prod.colorImages[selectedColor] && prod.colorImages[selectedColor].length > 0)
        ? prod.colorImages[selectedColor]
        : prod.images;
      updateGallery(colorImages);
    });
  });

  // Bind add button
  const btnAdd = detailsModalContent.querySelector('#btn-add-details');
  btnAdd.addEventListener('click', () => {
    if (!currentUser) {
      alert("Please log in or sign up first to access your sizing profile.");
      detailsModal.classList.remove('open');
      loginTriggerBtn.click();
      return;
    }

    if (!twin || !twin.chest || !twin.waist || !twin.belly || !twin.hips) {
      alert("Please enter your AI Tailor body measurements first so we can determine your size.");
      detailsModal.classList.remove('open');
      twinBtn.click();
      return;
    }

    let selectedSize = '';
    const activeSizeBtn = detailsModalContent.querySelector('.size-btn.active');
    if (activeSizeBtn) {
      selectedSize = activeSizeBtn.getAttribute('data-size');
    } else if (autoSizeValue) {
      selectedSize = autoSizeValue; // use recommendation directly
    } else {
      selectedSize = prod.sizes[0];
    }
    
    const selectedColor = detailsModalContent.querySelector('.color-btn.active') 
      ? detailsModalContent.querySelector('.color-btn.active').getAttribute('data-color') 
      : 'Standard';
      
    addToCart(prod, selectedSize, selectedColor);
    detailsModal.classList.remove('open');
    cartOverlay.classList.add('open');
  });

  detailsModal.classList.add('open');
}

// Add item to cart
function addToCart(product, size, color) {
  const itemsField = cart.role === 'creator' ? 'creatorItems' : 'friendItems';
  
  const existing = cart[itemsField].find(item => item.productId === product.id && item.size === size && item.color === color);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart[itemsField].push({
      productId: product.id,
      name: product.name,
      image: (product.colorImages && product.colorImages[color] && product.colorImages[color][0]) ? product.colorImages[color][0] : (product.images[0] || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop'),
      supplier: product.supplier,
      singlePrice: product.singlePrice,
      bulkPrice: product.bulkPrice,
      size: size,
      color: color,
      quantity: 1
    });
  }
  
  saveCartAndSync();
}

// Remove or update cart item
function updateCartItemQty(productId, size, color, change, targetList) {
  const itemsField = targetList === 'creator' ? 'creatorItems' : 'friendItems';
  
  const existing = cart[itemsField].find(item => item.productId === productId && item.size === size && item.color === color);
  if (existing) {
    existing.quantity += change;
    if (existing.quantity <= 0) {
      cart[itemsField] = cart[itemsField].filter(item => !(item.productId === productId && item.size === size && item.color === color));
    }
    saveCartAndSync();
  }
}

// Remove item completely
function removeCartItem(productId, size, color, targetList) {
  const itemsField = targetList === 'creator' ? 'creatorItems' : 'friendItems';
  cart[itemsField] = cart[itemsField].filter(item => !(item.productId === productId && item.size === size && item.color === color));
  saveCartAndSync();
}

// Save cart to local storage and sync to Server
async function saveCartAndSync() {
  localStorage.setItem('styla_ps_cart', JSON.stringify(cart));
  
  updateCartUI();
  
  try {
    await fetch('/api/store-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: cart.id,
        creatorItems: cart.creatorItems,
        friendItems: cart.friendItems,
        creatorUsername: cart.role === 'creator' && currentUser ? currentUser.username : (cart.creatorUsername || undefined),
        creatorMeasurements: twin || undefined
      })
    });
  } catch (err) {
    console.warn("Failed to sync cart to server, fallback to local variables:", err);
  }
}

// Update Cart UI
function updateCartUI() {
  const totalQty = getCartTotalQuantity();
  const isUnlocked = totalQty >= 4;
  
  cartCountBadge.innerText = totalQty;
  
  if (isUnlocked) {
    statusUnlockedBanner.className = 'group-status-banner unlocked';
    statusBannerText.innerHTML = `<strong>Cart Unlocked!</strong> ${totalQty}/4 items. You are getting the VIP Group Price!`;
  } else {
    statusUnlockedBanner.className = 'group-status-banner pending';
    statusBannerText.innerText = `Cart: ${totalQty}/4 items. Add ${4 - totalQty} more to unlock VIP Group Pricing.`;
  }
  
  const progressRatio = Math.min((totalQty / 4) * 100, 100);
  funnelProgressRatio.innerText = `${totalQty} / 4 ITEMS`;
  funnelProgressBar.style.width = `${progressRatio}%`;
  
  if (isUnlocked) {
    funnelProgressBar.className = 'funnel-progress-bar unlocked';
    funnelMsg.className = 'funnel-msg unlocked-msg';
    funnelMsg.innerHTML = `\uD83C\uDF89 VIP Group Pricing unlocked! You saved shipping costs by consolidating 4+ items from China suppliers.`;
  } else {
    funnelProgressBar.className = 'funnel-progress-bar';
    funnelMsg.className = 'funnel-msg pending-msg';
    funnelMsg.innerHTML = `Add <strong>${4 - totalQty}</strong> more item${(4 - totalQty) > 1 ? 's' : ''} to reach VIP Group Shipping threshold! Share with a friend to split the order.`;
  }
  
  // Update Co-Shopping Hero Header live copy link input
  const coHeroUrl = document.getElementById('co-hero-share-url');
  const encodedState = totalQty > 0 ? encodeURIComponent(btoa(JSON.stringify({
    creatorItems: cart.creatorItems,
    friendItems: cart.friendItems,
    role: 'creator'
  }))) : '';
  const shareUrl = totalQty > 0 ? `${window.location.origin}${window.location.pathname}?cartId=${cart.id}&cartState=${encodedState}` : 'Add items to generate link...';
  
  if (coHeroUrl) {
    coHeroUrl.value = shareUrl;
  }
  
  if (totalQty > 0) {
    shareLinkUrl.innerText = shareUrl;
    btnCopyShare.removeAttribute('disabled');
  } else {
    shareLinkUrl.innerText = 'Add items to generate link...';
    btnCopyShare.setAttribute('disabled', 'true');
  }

  renderCartSection('creator', cart.creatorItems, creatorCount, creatorCartList);
  
  if (cart.friendItems.length > 0 || cart.role === 'friend') {
    friendCartSection.classList.remove('hidden');
    renderCartSection('friend', cart.friendItems, friendCount, friendCartList);
  } else {
    friendCartSection.classList.add('hidden');
  }

  let subtotal = 0;
  let savings = 0;
  const priceField = isUnlocked ? 'bulkPrice' : 'singlePrice';
  
  cart.creatorItems.forEach(item => {
    subtotal += item[priceField] * item.quantity;
    if (isUnlocked) savings += (item.singlePrice - item.bulkPrice) * item.quantity;
  });
  
  cart.friendItems.forEach(item => {
    subtotal += item[priceField] * item.quantity;
    if (isUnlocked) savings += (item.singlePrice - item.bulkPrice) * item.quantity;
  });
  
  const shipping = (totalQty === 0 || isUnlocked) ? 0 : 20;
  if (isUnlocked) savings += 20;

  const total = subtotal + shipping;

  cartSubtotal.innerText = `$${subtotal}`;
  cartShipping.innerText = shipping === 0 ? 'FREE' : `$${shipping}`;
  cartTotal.innerText = `$${total}`;

  if (isUnlocked && savings > 0) {
    cartSavingsRow.classList.remove('hidden');
    cartSavingsAmount.innerText = `$${savings}`;
  } else {
    cartSavingsRow.classList.add('hidden');
  }

  // Update payment status badge in cart overlay
  const paymentStatusRow = document.getElementById('cart-payment-status-row');
  const paymentStatusBadge = document.getElementById('cart-payment-status-badge');
  
  if (paymentStatusRow && paymentStatusBadge) {
    if (cart.paymentStatus && cart.paymentStatus !== 'unpaid') {
      paymentStatusRow.classList.remove('hidden');
      paymentStatusBadge.innerText = cart.paymentStatus.replace('_', ' ').toUpperCase();
      
      paymentStatusBadge.className = 'cart-payment-status';
      if (cart.paymentStatus === 'paid') {
        paymentStatusBadge.classList.add('paid');
      } else if (cart.paymentStatus === 'partially_paid') {
        paymentStatusBadge.classList.add('partially');
      } else {
        paymentStatusBadge.classList.add('unpaid');
      }
    } else {
      paymentStatusRow.classList.add('hidden');
    }
  }

  // Disable checkout trigger if fully paid
  const btnCheckout = document.getElementById('btn-checkout-trigger');
  if (btnCheckout) {
    if (cart.paymentStatus === 'paid') {
      btnCheckout.innerText = "BATCH FULLY PAID";
      btnCheckout.setAttribute('disabled', 'true');
      btnCheckout.style.backgroundColor = '#16a34a';
      btnCheckout.style.borderColor = '#16a34a';
      btnCheckout.style.color = '#fff';
    } else {
      btnCheckout.innerText = "Checkout Batch";
      btnCheckout.removeAttribute('disabled');
      btnCheckout.style.backgroundColor = '';
      btnCheckout.style.borderColor = '';
      btnCheckout.style.color = '';
    }
  }

  // Sync Floating HUD progress
  const hud = document.getElementById('co-shopping-hud');
  const hudProgressText = document.getElementById('co-hud-progress-text');
  const hudSavingsText = document.getElementById('co-hud-savings-text');
  const hudProgressBar = document.getElementById('co-hud-progress-bar');
  const hudStatusDesc = document.getElementById('co-hud-status-desc');
  
  if (hud) {
    if (totalQty > 0 && !hud.classList.contains('closed-manually')) {
      hud.classList.remove('hidden');
      hudProgressText.innerText = `${totalQty} / 4 ITEMS`;
      hudProgressBar.style.width = `${progressRatio}%`;
      
      if (isUnlocked) {
        hudProgressBar.style.background = '#10b981';
        hudStatusDesc.innerHTML = `\uD83C\uDF89 <strong>VIP Group Pricing Unlocked!</strong> Free shipping active.`;
        if (savings > 0) {
          hudSavingsText.classList.remove('hidden');
          hudSavingsText.innerText = `Saved $${savings}`;
        } else {
          hudSavingsText.classList.add('hidden');
        }
      } else {
        hudProgressBar.style.background = 'linear-gradient(90deg, #10b981, #3b82f6)';
        hudStatusDesc.innerHTML = `Add <strong>${4 - totalQty}</strong> more items to unlock VIP Group pricing.`;
        hudSavingsText.classList.add('hidden');
      }
    } else {
      hud.classList.add('hidden');
    }
  }

  // Trigger co-shopping simulation log if items are added by the creator
  if (cart.role === 'creator' && totalQty > 0 && !hasSimulatedJoin) {
    hasSimulatedJoin = true;
    startCoShoppingSimulation();
  }
}

function renderCartSection(role, items, countEl, listEl) {
  countEl.innerText = items.reduce((sum, item) => sum + item.quantity, 0);
  
  if (items.length === 0) {
    listEl.innerHTML = '<div class="no-items" style="font-size:0.8rem; color:#999; padding: 0.5rem 0;">No items added yet.</div>';
    return;
  }
  
  const totalQty = getCartTotalQuantity();
  const isUnlocked = totalQty >= 4;

  listEl.innerHTML = items.map(item => {
    const currentPrice = isUnlocked ? item.bulkPrice : item.singlePrice;
    const isDiscounted = isUnlocked;

    return `
      <div class="cart-item">
        <div class="cart-item-img-wrap">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <div>
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-meta">Size: ${item.size} | Color: ${item.color || 'Standard'}</div>
            <div class="cart-item-prices">
              <span class="cart-item-price-current">$${currentPrice}</span>
              ${isDiscounted ? `<span class="cart-item-price-was">$${item.singlePrice}</span>` : ''}
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            ${(cart.role === role) ? `
              <div class="cart-item-qty-control">
                <button class="qty-btn" data-id="${item.productId}" data-size="${item.size}" data-color="${item.color || 'Standard'}" data-change="-1">-</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-btn" data-id="${item.productId}" data-size="${item.size}" data-color="${item.color || 'Standard'}" data-change="1">+</button>
              </div>
              <button class="btn-remove-item" data-id="${item.productId}" data-size="${item.size}" data-color="${item.color || 'Standard'}">Remove</button>
            ` : `
              <div class="cart-item-qty-control" style="border:none; padding:0;">
                <span class="qty-val" style="color:#666;">Qty: ${item.quantity}</span>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const size = btn.getAttribute('data-size');
      const color = btn.getAttribute('data-color');
      const change = parseInt(btn.getAttribute('data-change'));
      updateCartItemQty(id, size, color, change, role);
    });
  });

  listEl.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const size = btn.getAttribute('data-size');
      const color = btn.getAttribute('data-color');
      removeCartItem(id, size, color, role);
    });
  });
}

// Helper to sum quantities in cart
function getCartTotalQuantity() {
  const creatorTotal = cart.creatorItems.reduce((sum, item) => sum + item.quantity, 0);
  const friendTotal = cart.friendItems.reduce((sum, item) => sum + item.quantity, 0);
  return creatorTotal + friendTotal;
}

// Render checkout summary box inside modal
// Render checkout summary box inside modal
function renderCheckoutSummary() {
  const totalQty = getCartTotalQuantity();
  const isUnlocked = totalQty >= 4;
  
  let creatorSub = 0;
  let creatorSavings = 0;
  cart.creatorItems.forEach(item => {
    creatorSub += (isUnlocked ? item.bulkPrice : item.singlePrice) * item.quantity;
    if (isUnlocked) creatorSavings += (item.singlePrice - item.bulkPrice) * item.quantity;
  });
  
  let friendSub = 0;
  let friendSavings = 0;
  cart.friendItems.forEach(item => {
    friendSub += (isUnlocked ? item.bulkPrice : item.singlePrice) * item.quantity;
    if (isUnlocked) friendSavings += (item.singlePrice - item.bulkPrice) * item.quantity;
  });
  
  const creatorShipping = (cart.creatorItems.length > 0 && !isUnlocked) ? 20 : 0;
  const friendShipping = (cart.friendItems.length > 0 && !isUnlocked) ? 20 : 0;
  
  const creatorTotal = creatorSub + creatorShipping;
  const friendTotal = friendSub + friendShipping;

  let modalHtml = '';
  
  if (totalQty === 0) {
    modalHtml = `<div class="no-items" style="text-align:center; padding: 2rem;">Your cart is empty. Please add items before checking out.</div>`;
    checkoutUnlockedSummary.innerHTML = modalHtml;
    return;
  }
  
  const isCreator = (cart.role === 'creator');
  const creatorPaid = cart.creatorPaid || false;
  const friendPaid = cart.friendPaid || false;
  
  if (!isUnlocked) {
    modalHtml = `
      <div style="text-align:center; padding: 1rem 0 2rem;">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">🤔</div>
        <h3 style="font-family:var(--font-serif); font-size:1.4rem; margin-bottom:0.75rem;">VIP Group Shipping Not Unlocked Yet</h3>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem; max-width:450px; margin-left:auto; margin-right:auto;">
          You only have <strong>${totalQty} of 4</strong> items in your cart. If you checkout now, you will pay the full single item price and wait longer for shipping consolidated batches.
        </p>
        <div style="background-color:#fffbeb; border:1px solid #fef3c7; padding:1rem; border-radius:6px; margin-bottom:1.5rem; text-align:left; font-size:0.85rem; color:#b45309;">
          <strong>Pro-tip:</strong> Copy the shareable link in the cart panel and send it to a friend to add items and instantly unlock VIP Group Pricing for both of you!
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${isCreator ? `
            <button class="btn-checkout-all" id="btn-force-checkout" style="grid-column: span 2;">
              Checkout Anyway at Full Price ($${creatorTotal + friendTotal})
            </button>
          ` : `
            <div style="background-color: #f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:12px; text-align:center; font-size:0.85rem; color:#0369a1; font-weight:500; margin-bottom:12px;">
              ℹ️ Only the Cart Author can checkout early at full price. Friends must wait for the author or join a complete batch.
            </div>
          `}
          <button class="btn-secondary-sm" id="btn-checkout-cancel" style="padding:12px;">
            Go Back & Share
          </button>
        </div>
      </div>
    `;
    checkoutUnlockedSummary.innerHTML = modalHtml;
    
    if (isCreator) {
      document.getElementById('btn-force-checkout').addEventListener('click', () => {
        showBillingForm('all', creatorTotal + friendTotal);
      });
    }
    document.getElementById('btn-checkout-cancel').addEventListener('click', () => {
      checkoutModal.classList.remove('open');
      cartOverlay.classList.add('open');
    });
    return;
  }
  
  modalHtml = `
    <div style="background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; text-align: center; font-size: 0.85rem; font-weight: 600;">
      ✓ VIP GROUP PRICING & SHIPPING UNLOCKED! BOTH PARTIES SAVE EXTRA.
    </div>
    
    <div class="checkout-grid-layout" style="display:grid; grid-template-columns:1fr; gap:1.5rem;">
      <div class="checkout-party-box" style="position:relative; ${creatorPaid ? 'border-color: #bbf7d0; background-color:#f8fafc;' : ''}">
        <div class="checkout-party-title">
          <div style="display:flex; align-items:center; gap: 8px;">
            <span>USER A (CREATOR'S SHARE)</span>
            <span class="badge-role-tag admin">Cart Author</span>
            ${creatorPaid ? '<span class="badge-role-tag" style="background:#dcfce7; color:#15803d; margin-left:8px;">PAID</span>' : ''}
          </div>
          <span class="checkout-party-price">$${creatorTotal}</span>
        </div>
        ${cart.creatorItems.map(item => `
          <div class="checkout-item-mini">
            <span>${item.quantity}x ${item.name} (${item.size} - ${item.color || 'Standard'})</span>
            <span>$${item.bulkPrice * item.quantity}</span>
          </div>
        `).join('')}
        <div class="checkout-item-mini" style="border-top: 1px dashed #e4e4e7; margin-top:6px; padding-top:6px;">
          <span>Consolidated Shipping</span>
          <span style="color:#16a34a; font-weight:600;">FREE</span>
        </div>
        <div class="checkout-item-mini" style="color:#16a34a; font-weight:600;">
          <span>Items Discount Savings</span>
          <span>-$${creatorSavings}</span>
        </div>
        
        <div class="checkout-split-actions" style="grid-template-columns: 1fr;">
          <button class="btn-checkout-split" id="btn-pay-creator" ${cart.creatorItems.length === 0 || creatorPaid || !isCreator ? 'disabled' : ''} style="${creatorPaid ? 'background:#f4f4f5; color:#a1a1aa; border-color:#e4e4e7; cursor:not-allowed;' : ''}">
            ${creatorPaid ? 'Creator Share Paid ✓' : (isCreator ? `Pay Creator Share ($${creatorTotal})` : `Creator's Share (Only Author can pay)`)}
          </button>
        </div>
      </div>

      ${cart.friendItems.length > 0 ? `
        <div class="checkout-party-box" style="position:relative; ${friendPaid ? 'border-color: #bbf7d0; background-color:#f8fafc;' : ''}">
          <div class="checkout-party-title">
            <div style="display:flex; align-items:center; gap: 8px;">
              <span>USER B (FRIEND'S SHARE)</span>
              <span class="badge-role-tag friend">Friend</span>
              ${friendPaid ? '<span class="badge-role-tag" style="background:#dcfce7; color:#15803d; margin-left:8px;">PAID</span>' : ''}
            </div>
            <span class="checkout-party-price">$${friendTotal}</span>
          </div>
          ${cart.friendItems.map(item => `
            <div class="checkout-item-mini">
              <span>${item.quantity}x ${item.name} (${item.size} - ${item.color || 'Standard'})</span>
              <span>$${item.bulkPrice * item.quantity}</span>
            </div>
          `).join('')}
          <div class="checkout-item-mini" style="border-top: 1px dashed #e4e4e7; margin-top:6px; padding-top:6px;">
            <span>Consolidated Shipping</span>
            <span style="color:#16a34a; font-weight:600;">FREE</span>
          </div>
          <div class="checkout-item-mini" style="color:#16a34a; font-weight:600;">
            <span>Items Discount Savings</span>
            <span>-$${friendSavings}</span>
          </div>
          
          <div class="checkout-split-actions" style="grid-template-columns: 1fr;">
            <button class="btn-checkout-split" id="btn-pay-friend" ${friendPaid || isCreator ? 'disabled' : ''} style="${friendPaid ? 'background:#f4f4f5; color:#a1a1aa; border-color:#e4e4e7; cursor:not-allowed;' : ''}">
              ${friendPaid ? 'Friend Share Paid ✓' : (!isCreator ? `Pay Friend Share ($${friendTotal})` : `Friend's Share (Waiting for Friend to pay)`)}
            </button>
          </div>
        </div>
      ` : `
        <div class="checkout-party-box" style="border-style:dashed; text-align:center; padding: 2rem;">
          <p style="font-size:0.85rem; color:#999;">No friend items in this cart. Invite a friend using the link to split the shipping batch!</p>
        </div>
      `}

      ${isCreator ? `
        <button class="btn-checkout-all" id="btn-pay-all" ${(creatorPaid && friendPaid) ? 'disabled' : ''}>
          Pay Entire Consolidated Cart ($${creatorTotal + friendTotal})
        </button>
      ` : `
        <div style="background-color: #f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:10px; text-align:center; font-size:0.75rem; color:#0369a1; font-weight:500;">
          ℹ️ Consolidated checkout (paying for everyone) is only available to the Cart Author.
        </div>
      `}
    </div>
  `;
  
  checkoutUnlockedSummary.innerHTML = modalHtml;
  
  if (isCreator && !creatorPaid && cart.creatorItems.length > 0) {
    document.getElementById('btn-pay-creator').addEventListener('click', () => {
      showBillingForm('creator', creatorTotal);
    });
  }
  
  if (!isCreator && !friendPaid && cart.friendItems.length > 0) {
    document.getElementById('btn-pay-friend').addEventListener('click', () => {
      showBillingForm('friend', friendTotal);
    });
  }
  
  if (isCreator && !(creatorPaid && friendPaid)) {
    document.getElementById('btn-pay-all').addEventListener('click', () => {
      showBillingForm('all', creatorTotal + friendTotal);
    });
  }
}

// Show Credit Card Billing Form inside Modal (Redirecting directly to Stripe Checkout)
function showBillingForm(roleToPay, amountToPay) {
  const targetElement = document.getElementById('checkout-unlocked-summary');
  
  const formHtml = `
    <div class="billing-form-container" style="text-align: center; padding: 1.5rem 0;">
      <h3 class="billing-form-title" style="margin-bottom: 0.5rem; justify-content: center;">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:inline-block; vertical-align:middle; margin-right:4px;">
          <rect width="22" height="16" x="1" y="4" rx="2" ry="2"></rect>
          <line x1="1" x2="23" y1="10" y2="10"></line>
        </svg>
        Stripe Checkout Portal
      </h3>
      <p style="font-size:0.95rem; color:var(--text-muted); margin-bottom: 1.75rem;">
        You are paying <strong>$${amountToPay.toFixed(2)}</strong> for ${roleToPay === 'all' ? 'Entire Consolidated Cart' : (roleToPay === 'creator' ? "Cart Creator's Share" : "Friend's Share")}.
      </p>
      
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 0 auto;">
        <button class="btn-checkout" id="btn-proceed-stripe" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
          Proceed to Stripe Checkout
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </button>
        <button class="btn-checkout" id="btn-billing-back" style="width: 100%; background: transparent; border: 1px solid var(--border-color); color: var(--text-main);">
          Back to Summary
        </button>
      </div>
    </div>
  `;
  
  targetElement.innerHTML = formHtml;
  
  document.getElementById('btn-proceed-stripe').addEventListener('click', async () => {
    await processPayment(roleToPay, amountToPay);
  });
  
  document.getElementById('btn-billing-back').addEventListener('click', () => {
    renderCheckoutSummary();
  });
}

// Simulated API and Stripe Process Animation
async function processPayment(roleToPay, amountToPay) {
  const targetElement = document.getElementById('checkout-unlocked-summary');
  
  targetElement.innerHTML = `
    <div class="payment-loader-wrap">
      <div class="payment-spinner"></div>
      <div class="payment-loading-text" id="payment-loading-text">Contacting Checkout Server...</div>
      <div class="payment-loading-sub" id="payment-loading-sub">Preparing secure transaction session...</div>
      
      <div class="api-log-console" id="processing-api-logs" style="width:100%; margin-top:2rem;">
        <div class="api-log-line info">[SYS] Initializing checkout process...</div>
      </div>
    </div>
  `;
  
  const loadingText = document.getElementById('payment-loading-text');
  const loadingSub = document.getElementById('payment-loading-sub');
  const apiLogs = document.getElementById('processing-api-logs');
  
  const addLog = (text, type = 'info') => {
    const line = document.createElement('div');
    line.className = `api-log-line ${type}`;
    line.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    apiLogs.appendChild(line);
    apiLogs.scrollTop = apiLogs.scrollHeight;
  };

  await new Promise(r => setTimeout(r, 800));
  addLog(`[API] Creating Stripe checkout session for ${roleToPay.toUpperCase()} share ($${amountToPay.toFixed(2)})...`, 'info');

  try {
    const res = await fetch('/api/store-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-checkout-session',
        cartId: cart.id,
        role: roleToPay,
        amount: amountToPay
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create secure checkout session.");
    }
    
    const data = await res.json();
    addLog("[STRIPE] Checkout session created successfully. Initializing redirect...", 'info');
    
    loadingText.innerText = "Redirecting to Stripe...";
    loadingSub.innerText = "Redirecting to bank gateway...";
    
    await new Promise(r => setTimeout(r, 800));
    
    // Initialize Stripe client using backend-provided publishable key
    if (!window.Stripe) {
      throw new Error("Stripe.js library failed to load. Please check your internet connection.");
    }
    
    // Use the backend publishable key or fallback to a standard publishable key if not configured
    const stripePublicKey = data.publishableKey || 'pk_live_51TiFOU2KQ3LS8UujB9QaSTFoAPeCOYRXExRhEubyGcOpycEDSOmE9KW1AVNOA19fab3xIuhDqeoDcX6smDbOKLbj007kAiKikJ';
    const stripe = window.Stripe(stripePublicKey);
    
    const result = await stripe.redirectToCheckout({
      sessionId: data.id
    });
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
  } catch (err) {
    addLog(`[API] Error: ${err.message}`, 'error');
    targetElement.innerHTML = `
      <div style="text-align:center; padding:2rem 0;">
        <h2 style="font-family:var(--font-serif); font-size:1.6rem; margin-bottom:0.75rem;">Checkout Failed</h2>
        <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:1.5rem;">
          ${err.message}
        </p>
        <button class="btn-checkout" id="btn-payment-error-back" style="max-width: 250px; margin: 0 auto;">
          Try Again
        </button>
      </div>
    `;
    document.getElementById('btn-payment-error-back').addEventListener('click', () => {
      renderCheckoutSummary();
    });
  }
}

function showPaymentSuccess(rolePaid, amountPaid, updatedCart) {
  const targetElement = document.getElementById('checkout-unlocked-summary');
  
  let successMsg = '';
  if (updatedCart.paymentStatus === 'paid') {
    successMsg = `
      <h2 style="font-family:var(--font-serif); font-size:1.8rem; margin-bottom:0.75rem;">Batch Fully Paid!</h2>
      <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:1.5rem; max-width:450px; margin-left:auto; margin-right:auto;">
        Thank you! All shares for this group cart have been paid. Styla will now purchase these items from China manufacturer suppliers and begin consolidated shipment.
      </p>
    `;
  } else {
    successMsg = `
      <h2 style="font-family:var(--font-serif); font-size:1.8rem; margin-bottom:0.75rem;">Share Payment Successful!</h2>
      <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:1.5rem; max-width:450px; margin-left:auto; margin-right:auto;">
        Your share of the cart has been recorded. We are waiting for the other party to pay their share. Once both pay, the consolidated shipment will release from China.
      </p>
    `;
  }
  
  targetElement.innerHTML = `
    <div style="text-align:center; padding: 1.5rem 0;">
      <div class="payment-success-icon">✓</div>
      ${successMsg}
      
      <div class="payment-receipt-box">
        <div class="payment-receipt-title">STYLA OFFICIAL RECEIPT</div>
        <div>CART ID: ${updatedCart.id}</div>
        <div>PAYMENT METHOD: Stripe Sandbox</div>
        <div>ROLE PAID: ${rolePaid.toUpperCase()}</div>
        <div>PAID AMOUNT: $${amountPaid.toFixed(2)}</div>
        <div style="margin-top:8px; border-top:1px dashed #d4d4d8; padding-top:8px;">
          STATUS: <span style="font-weight:700; color:${updatedCart.paymentStatus === 'paid' ? '#16a34a' : '#b45309'}">${updatedCart.paymentStatus.toUpperCase()}</span>
        </div>
        <div>SHIPPING METHOD: China Air Cargo (Consolidated)</div>
      </div>
      
      <button class="btn-checkout" id="btn-checkout-success-close" style="max-width: 250px; margin: 0 auto;">
        ${updatedCart.paymentStatus === 'paid' ? 'Start a New Cart' : 'View Group Status'}
      </button>
    </div>
  `;
  
  document.getElementById('btn-checkout-success-close').addEventListener('click', () => {
    checkoutModal.classList.remove('open');
    if (updatedCart.paymentStatus === 'paid') {
      initializeNewCart();
    }
    updateCartUI();
  });
}

// Simulate Friend Adding Items
function simulateFriendAddingItems() {
  if (products.length === 0) return;
  
  const mockProd = products[1] || products[0];
  if (!mockProd) return;
  
  cart.friendItems = [
    {
      productId: mockProd.id,
      name: mockProd.name,
      image: mockProd.images[0] || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop',
      supplier: mockProd.supplier,
      singlePrice: mockProd.singlePrice,
      bulkPrice: mockProd.bulkPrice,
      size: 'M',
      color: mockProd.colors ? mockProd.colors[0] : 'Standard',
      quantity: 2
    }
  ];
  
  saveCartAndSync();
  showCoShoppingToast("Friend Joined Sim", "Friend simulation active: 2 items added to group cart!", "\uD83D\uDC65");
  cartOverlay.classList.add('open');
}

// Display modern co-shopping toast alerts
function showCoShoppingToast(title, desc, icon = "\uD83D\uDC65") {
  const container = document.getElementById('co-shopping-toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = 'co-toast';
  toast.innerHTML = `
    <div class="co-toast-icon">${icon}</div>
    <div class="co-toast-body">
      <div class="co-toast-title">${title}</div>
      <div class="co-toast-desc">${desc}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 5500);
}

// Simulated real-time cooperative shopping activity feed
function startCoShoppingSimulation() {
  // Stage 1: Sarah joins the cart after 8 seconds
  simulationTimer = setTimeout(() => {
    showCoShoppingToast(
      "User Joined Cart", 
      `@sarah clicked your link and joined the co-shopping session!`, 
      "\uD83D\uDC65"
    );
    
    // Stage 2: Sarah adds items after another 10 seconds
    simulationTimer = setTimeout(() => {
      if (products.length > 0) {
        const mockProd = products[1] || products[0];
        
        // Append items to friend cart
        cart.friendItems = [
          {
            productId: mockProd.id,
            name: mockProd.name,
            image: mockProd.images[0] || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop',
            supplier: mockProd.supplier,
            singlePrice: mockProd.singlePrice,
            bulkPrice: mockProd.bulkPrice,
            size: 'S',
            color: mockProd.colors ? mockProd.colors[0] : 'Standard',
            quantity: 2
          }
        ];
        
        saveCartAndSync();
        
        showCoShoppingToast(
          "Item Added by Friend", 
          `@sarah added 2x ${mockProd.name} (Size S) to the group cart.`, 
          "\uD83D\uDED2"
        );
        
        // Stage 3: VIP Group pricing unlocked notification
        setTimeout(() => {
          showCoShoppingToast(
            "VIP Pricing Unlocked!", 
            `Your combined cart reaches 4+ items. VIP Group Prices & Free Shipping are now active!`, 
            "\uD83C\uDF89"
          );
        }, 4000);
      }
    }, 10000);
  }, 8000);
}



// How to Measure Modal Logic
window.showMeasureModal = function(part) {
  const modal = document.getElementById('measure-modal');
  const title = document.getElementById('measure-modal-title');
  const desc = document.getElementById('measure-modal-desc');
  const img = document.getElementById('measure-modal-image');
  
  const instructions = {
    chest: { text: "Measure under your arms, around the fullest part of your chest.", img: "../images/measure_chest.png" },
    waist: { text: "Measure around your natural waistline, keeping the tape comfortably snug.", img: "../images/measure_waist.png" },
    belly: { text: "Measure around the fullest part of your abdomen (belly), usually at the level of the belly button (navel). A critical measurement for shirts, tops, and outerwear.", img: "../images/measure_belly.png" },
    hips: { text: "Measure around the fullest part of your body at the top of your leg.", img: "../images/measure_hips.png" },
    height: { text: "Your total height from head to toe in inches (e.g. 5'8\" = 68 inches).", img: "../images/measure_height.png" },
    inseam: { text: "Measure from your crotch down to the bottom of your leg/ankle.", img: "../images/measure_inseam.png" },
    shoulder: { text: "Measure from the outer edge of one shoulder across your back to the outer edge of the other shoulder.", img: "../images/measure_shoulder.png" },
    sleeve: { text: "Measure from the center back of your neck, across the shoulder, and down to your wrist.", img: "../images/measure_sleeve.png" },
    neck: { text: "Measure around the base of your neck where a shirt collar would sit.", img: "../images/measure_neck.png" },
    thigh: { text: "Measure around the fullest part of your thigh.", img: "../images/measure_thigh.png" },
    bicep: { text: "Measure around the widest part of your flexed bicep.", img: "../images/measure_bicep.png" },
    wrist: { text: "Measure around your wrist bone.", img: "../images/measure_wrist.png" },
    length: { text: "Measure from the base of your neck down to your waist (torso length).", img: "../images/measure_length.png" }
  };
  
  if (!instructions[part]) return;
  
  title.textContent = `How to measure your ${part.charAt(0).toUpperCase() + part.slice(1)}`;
  desc.textContent = instructions[part].text;
  
  if (instructions[part].img) {
      img.src = instructions[part].img;
      img.style.display = 'block';
  } else {
      img.style.display = 'none';
  }
  
  modal.classList.add('open');
};

window.closeMeasureModal = function(e) {
  if (e) e.stopPropagation();
  document.getElementById('measure-modal').classList.remove('open');
};

init();