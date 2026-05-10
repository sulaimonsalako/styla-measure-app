const fileUpload = document.getElementById('file-upload');
const dropZone = document.getElementById('drop-zone');
const dropText = document.getElementById('drop-text');
const previewImg = document.getElementById('preview-img'); // Keeping for legacy if needed, but we use chart-preview-container
const chartPreviewContainer = document.getElementById('chart-preview-container');

const styleFileUpload = document.getElementById('style-file-upload');
const styleDropZone = document.getElementById('style-drop-zone');
const styleDropText = document.getElementById('style-drop-text');
const stylePreviewContainer = document.getElementById('style-preview-container');

const btnDecode = document.getElementById('btn-decode');
const resultBox = document.getElementById('result-box');

const loader = document.getElementById('loader');
const loaderStatus = document.getElementById('loader-status');

const saveProfileBox = document.getElementById('save-profile-box');
const btnSaveProfile = document.getElementById('btn-save-profile');

// Initialize Supabase Client Variables
const SUPABASE_URL = "https://tneflxtpmzodauygtslk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZWZseHRwbXpvZGF1eWd0c2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzA1NTMsImV4cCI6MjA5MzkwNjU1M30.DkzB5-novfMp1IaY4d9710YTv_U7DME3_EC8Jc87MLc";

// Load saved Digital Twin measurements on page load
window.addEventListener('DOMContentLoaded', async () => {
  const savedChest = localStorage.getItem('styla_twin_chest');
  const savedWaist = localStorage.getItem('styla_twin_waist');
  const savedHips = localStorage.getItem('styla_twin_hips');
  const savedHeight = localStorage.getItem('styla_twin_height'); // Total inches
  const savedInseam = localStorage.getItem('styla_twin_inseam');

  if (savedChest) document.getElementById('val-chest').value = savedChest;
  if (savedWaist) document.getElementById('val-waist').value = savedWaist;
  if (savedHips) document.getElementById('val-hips').value = savedHips;
  if (savedInseam) document.getElementById('val-inseam').value = savedInseam;
  
  if (savedHeight) {
      const totalInches = parseInt(savedHeight, 10);
      const ft = Math.floor(totalInches / 12);
      const inches = totalInches % 12;
      document.getElementById('val-height-ft').value = ft;
      document.getElementById('val-height-in').value = inches;
  }

  // Attempt to check for an active Supabase cloud session
  try {
      if (window.supabase) {
          const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
              // User is logged in! Fetch their profile.
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
                
              if (profile) {
                  if (profile.chest) document.getElementById('val-chest').value = profile.chest;
                  if (profile.waist) document.getElementById('val-waist').value = profile.waist;
                  if (profile.hips) document.getElementById('val-hips').value = profile.hips;
                  if (profile.inseam) document.getElementById('val-inseam').value = profile.inseam;
                  if (profile.height) {
                      const ft = Math.floor(profile.height / 12);
                      const inches = profile.height % 12;
                      document.getElementById('val-height-ft').value = ft;
                      document.getElementById('val-height-in').value = inches;
                  }
                  
                  // Update UI to show they are logged in
                  document.getElementById('btn-show-login').style.display = 'none';
                  document.getElementById('logged-in-status').style.display = 'flex';
                  document.getElementById('save-profile-box').style.display = 'none'; // Don't ask them to save again
              }
          }
      }
  } catch (err) {
      console.log("Supabase session check skipped or failed.", err);
  }
});

// "How to Measure" Modal Logic
function showMeasureModal(part) {
  const modal = document.getElementById('measure-modal');
  const title = document.getElementById('modal-title');
  const desc = document.getElementById('modal-desc');
  const img = document.getElementById('modal-image');
  
  const instructions = {
    chest: { text: "Measure under your arms, around the fullest part of your chest.", img: "images/measure_chest.png" },
    waist: { text: "Measure around your natural waistline, keeping the tape a bit loose.", img: "images/measure_waist.png" },
    hips: { text: "Measure around the fullest part of your body at the top of your leg.", img: "images/measure_hips.png" },
    height: { text: "Your total height from head to toe in inches (e.g. 5'4\" = 64 inches).", img: "images/measure_height.png" },
    inseam: { text: "Measure from your crotch to the bottom of your leg/ankle.", img: "images/measure_inseam.png" }
  };
  
  title.textContent = `How to measure your ${part.charAt(0).toUpperCase() + part.slice(1)}`;
  desc.textContent = instructions[part].text;
  
  if (instructions[part].img) {
      img.src = instructions[part].img;
      img.style.display = 'block';
  } else {
      img.style.display = 'none';
  }
  
  modal.style.display = 'flex';
}

function closeMeasureModal(e) {
  if (e) e.stopPropagation();
  document.getElementById('measure-modal').style.display = 'none';
}

let chartBase64Images = [];
let styleBase64Images = [];

// Handle Chart File Selection
fileUpload.addEventListener('change', (e) => handleChartFiles(e.target.files));
styleFileUpload.addEventListener('change', (e) => handleStyleFiles(e.target.files));

function handleChartFiles(files) {
    if (!files || files.length === 0) return;
    
    dropText.style.display = 'none';
    if (chartPreviewContainer) chartPreviewContainer.innerHTML = '';
    chartBase64Images = [];
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            chartBase64Images.push(base64);
            
            const img = document.createElement('img');
            img.src = base64;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid rgba(255,255,255,0.2)';
            if (chartPreviewContainer) chartPreviewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

function handleStyleFiles(files) {
    if (!files || files.length === 0) return;
    
    styleDropText.style.display = 'none';
    stylePreviewContainer.innerHTML = '';
    styleBase64Images = [];
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            styleBase64Images.push(base64);
            
            const img = document.createElement('img');
            img.src = base64;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid rgba(255,255,255,0.2)';
            stylePreviewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

// Handle Drag & Drop for Chart
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#8b5cf6'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)'; });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    fileUpload.files = e.dataTransfer.files;
    handleChartFiles(e.dataTransfer.files);
  }
});

// Handle Drag & Drop for Style Image
styleDropZone.addEventListener('dragover', (e) => { e.preventDefault(); styleDropZone.style.borderColor = '#8b5cf6'; });
styleDropZone.addEventListener('dragleave', () => { styleDropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)'; });
styleDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  styleDropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    styleFileUpload.files = e.dataTransfer.files;
    handleStyleFiles(e.dataTransfer.files);
  }
});

// Dynamic Loader Animation
function startLoader() {
  btnDecode.style.display = 'none';
  loader.style.display = 'block';
  resultBox.style.display = 'none';
  saveProfileBox.style.display = 'none';
  
  const texts = [
    "Reading the size chart...",
    "Calculating body geometry...",
    "Drafting your fit..."
  ];
  let i = 0;
  window.loaderInterval = setInterval(() => {
    i = (i + 1) % texts.length;
    loaderStatus.textContent = texts[i];
  }, 1500);
}

function stopLoader() {
  clearInterval(window.loaderInterval);
  loader.style.display = 'none';
  btnDecode.style.display = 'block';
}

// Submit for AI Decoding
btnDecode.addEventListener('click', async () => {
  const chest = document.getElementById('val-chest').value;
  const waist = document.getElementById('val-waist').value;
  const hips = document.getElementById('val-hips').value;
  const inseam = document.getElementById('val-inseam').value;
  
  const ftStr = document.getElementById('val-height-ft').value;
  const inStr = document.getElementById('val-height-in').value;
  let height = "";
  if (ftStr !== "" && inStr !== "") {
      height = (parseInt(ftStr, 10) * 12) + parseInt(inStr, 10);
  }

  if (!chest || !waist || !hips) {
    alert("Please enter at least Chest, Waist, and Hips.");
    return;
  }
  if (!chartBase64Images || chartBase64Images.length === 0) {
    alert("Please upload at least one size chart.");
    return;
  }
  if (!styleBase64Images || styleBase64Images.length === 0) {
    alert("Please upload garment photos so the AI can determine the intended fit.");
    return;
  }

  // Save to LocalStorage so they don't have to type it again!
  localStorage.setItem('styla_twin_chest', chest);
  localStorage.setItem('styla_twin_waist', waist);
  localStorage.setItem('styla_twin_hips', hips);
  if(height) localStorage.setItem('styla_twin_height', height);
  if(inseam) localStorage.setItem('styla_twin_inseam', inseam);

  startLoader();

  try {
    const res = await fetch('/api/decode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chest, waist, hips, height, inseam,
        chartImagesBase64: chartBase64Images,
        styleImagesBase64: styleBase64Images
      })
    });

    const data = await res.json();
    stopLoader();

    if (res.ok) {
        let fitHtml = `
          <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; color: #a5b4fc;">
            ✨ Recommended Size: ${data.recommended_size}
          </div>
          <p style="margin-bottom: 1rem;">${data.explanation}</p>
        `;

        if (data.warning && data.warning.toLowerCase() !== "none" && data.warning.trim() !== "") {
            fitHtml += `
            <div style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; color: #fca5a5;">
              <strong>⚠️ Warning:</strong> ${data.warning}
            </div>`;
        }

        if (data.fit_breakdown) {
            fitHtml += `<h4 style="margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">Fit Breakdown</h4>`;
            fitHtml += `<ul style="list-style-type: none; padding-left: 0;">`;
            for (const [part, desc] of Object.entries(data.fit_breakdown)) {
                let icon = "📏";
                if (desc.toLowerCase().includes("tight") || desc.toLowerCase().includes("small")) icon = "🔴";
                if (desc.toLowerCase().includes("perfect") || desc.toLowerCase().includes("great")) icon = "🟢";
                if (desc.toLowerCase().includes("relaxed") || desc.toLowerCase().includes("large") || desc.toLowerCase().includes("oversized")) icon = "🔵";
                
                fitHtml += `<li style="margin-bottom: 0.5rem; display: flex; align-items: start; gap: 0.5rem;">
                              <span>${icon}</span>
                              <span><strong>${part.charAt(0).toUpperCase() + part.slice(1)}:</strong> ${desc}</span>
                            </li>`;
            }
            fitHtml += `</ul>`;
        }

        resultBox.innerHTML = fitHtml;
        resultBox.style.display = 'block';
        
        // Show the Save Profile gate
        saveProfileBox.style.display = 'block';
    } else {
        alert("Error: " + (data.error || "Failed to decode size."));
    }

  } catch (err) {
    stopLoader();
    alert("Network error occurred.");
    console.error(err);
  }
});

// Save Profile to Supabase Cloud
btnSaveProfile.addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  
  if (!email || password.length < 6) {
      alert("Please provide a valid email and a password (min 6 characters).");
      return;
  }
  
  btnSaveProfile.disabled = true;
  btnSaveProfile.textContent = "Creating Profile...";

  const chest = document.getElementById('val-chest').value;
  const waist = document.getElementById('val-waist').value;
  const hips = document.getElementById('val-hips').value;
  const inseam = document.getElementById('val-inseam').value;
  
  const ftStr = document.getElementById('val-height-ft').value;
  const inStr = document.getElementById('val-height-in').value;
  let height = "";
  if (ftStr !== "" && inStr !== "") {
      height = (parseInt(ftStr, 10) * 12) + parseInt(inStr, 10);
  }

  try {
      // Lazy load Supabase to prevent initial page crashes
      if (!window.supabase) {
          throw new Error("Supabase library failed to load. Check your connection or adblocker.");
      }
      const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // 1. Sign Up the User in Supabase Auth (This now passes measurements directly!)
      const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
              data: {
                  chest: chest,
                  waist: waist,
                  hips: hips,
                  height: height || null,
                  inseam: inseam || null
              }
          }
      });

      if (error) throw error;
      
      btnSaveProfile.textContent = "✓ Profile Saved to Cloud!";
      btnSaveProfile.style.background = "#10b981";
      
      // Also update the header UI immediately
      document.getElementById('btn-show-login').style.display = 'none';
      document.getElementById('logged-in-status').style.display = 'flex';
      
  } catch (err) {
      alert("Error: " + err.message);
      btnSaveProfile.textContent = "Save Profile to Cloud";
      btnSaveProfile.disabled = false;
  }
});

// -----------------------------------------
// Login & Logout Handlers
// -----------------------------------------

const btnShowLogin = document.getElementById('btn-show-login');
const btnLoginSubmit = document.getElementById('btn-login-submit');
const btnLogout = document.getElementById('btn-logout');
const loginModal = document.getElementById('login-modal');
const loginError = document.getElementById('login-error');

if (btnShowLogin) {
    btnShowLogin.addEventListener('click', () => {
        loginModal.style.display = 'flex';
        loginError.style.display = 'none';
    });
}

if (btnLoginSubmit) {
    btnLoginSubmit.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            loginError.textContent = "Please enter both email and password.";
            loginError.style.display = 'block';
            return;
        }
        
        btnLoginSubmit.disabled = true;
        btnLoginSubmit.textContent = "Logging in...";
        loginError.style.display = 'none';
        
        try {
            if (!window.supabase) throw new Error("Supabase is not loaded.");
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });
            
            if (error) throw error;
            
            // Login successful! Fetch profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();
              
            if (profile) {
                if (profile.chest) document.getElementById('val-chest').value = profile.chest;
                if (profile.waist) document.getElementById('val-waist').value = profile.waist;
                if (profile.hips) document.getElementById('val-hips').value = profile.hips;
                if (profile.inseam) document.getElementById('val-inseam').value = profile.inseam;
                if (profile.height) {
                    const ft = Math.floor(profile.height / 12);
                    const inches = profile.height % 12;
                    document.getElementById('val-height-ft').value = ft;
                    document.getElementById('val-height-in').value = inches;
                }
            }
            
            // Update UI
            loginModal.style.display = 'none';
            document.getElementById('btn-show-login').style.display = 'none';
            document.getElementById('logged-in-status').style.display = 'flex';
            document.getElementById('save-profile-box').style.display = 'none';
            
        } catch (err) {
            loginError.textContent = err.message;
            loginError.style.display = 'block';
        } finally {
            btnLoginSubmit.disabled = false;
            btnLoginSubmit.textContent = "Log In & Sync";
        }
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        try {
            if (window.supabase) {
                const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                await supabase.auth.signOut();
            }
            // Reset UI
            document.getElementById('btn-show-login').style.display = 'block';
            document.getElementById('logged-in-status').style.display = 'none';
            // Clear inputs
            document.getElementById('val-chest').value = '';
            document.getElementById('val-waist').value = '';
            document.getElementById('val-hips').value = '';
            document.getElementById('val-height-ft').value = '';
            document.getElementById('val-height-in').value = '';
            document.getElementById('val-inseam').value = '';
            // Clear storage
            localStorage.clear();
            alert("You have been successfully logged out.");
        } catch (err) {
            console.error("Logout failed", err);
        }
    });
}
