// Initialize 3DLook Mobile Tailor Widget Options
window.MTM_WIDGET_OPTIONS = {
  defaultValues: { email: 'guest@styla.ca' },
  onMeasurementsReady: (m) => {
    console.log("Measurements complete:", m);
    
    // Pre-fill signup email input in login modal
    const scanEmailVal = document.getElementById('scan-email').value;
    if (scanEmailVal) {
      const loginEmailInput = document.getElementById('login-email');
      if (loginEmailInput) loginEmailInput.value = scanEmailVal;
      const authEmailInput = document.getElementById('auth-email');
      if (authEmailInput) authEmailInput.value = scanEmailVal;
    }
    
    // Open signup/auth modal to choose a password
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
      loginModal.style.display = 'flex';
      if (typeof switchToSignup === 'function') {
        switchToSignup();
      }
      
      const modalDesc = document.getElementById('auth-modal-desc');
      if (modalDesc) {
        modalDesc.innerHTML = `<span style="color: #34d399; font-weight: 700;">✓ Scan Successful!</span> Set a password below to securely save your measurements to your cloud profile.`;
      }
    }
    
    // Refresh profile state after a short delay for webhook execution
    setTimeout(async () => {
      if (window.supabase) {
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const profile = await getOrCreateProfile(supabase, session.user);
            onUserLoggedIn(session.user, profile);
          } catch (err) {
            console.error("Failed to get or create profile on init:", err);
          }
        }
      }
    }, 3000);
  }
};

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

let chatHistory = [];

// AI Chat Widget Elements


// Initialize Supabase Client Variables
const SUPABASE_URL = "https://tneflxtpmzodauygtslk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZWZseHRwbXpvZGF1eWd0c2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzA1NTMsImV4cCI6MjA5MzkwNjU1M30.DkzB5-novfMp1IaY4d9710YTv_U7DME3_EC8Jc87MLc";

// Helper to get or create user profile in a self-healing way
async function getOrCreateProfile(supabase, user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
    
  if (error) throw error;
  
  let finalProfile = profile;
  if (!profile) {
    // Create profile if missing
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        api_scans: [],
        measurement_overrides: {}
      })
      .select()
      .single();
      
    if (createError) throw createError;
    finalProfile = newProfile;
  }
  
  // Auto-populate Savvy Davis measurements for suloasis@gmail.com
  if (user && user.email === 'suloasis@gmail.com' && !finalProfile.chest && !finalProfile.waist && !finalProfile.hips) {
    console.log("Auto-populating Savvy Davis measurements for suloasis@gmail.com...");
    const updates = {
      chest: 36.4,
      waist: 30.8,
      belly: 32.1,
      hips: 37.9,
      height: 64.0,
      inseam: 26.4,
      api_scans: [
        {
          scan_id: "scan_test_savvy",
          timestamp: new Date().toISOString(),
          is_active: true,
          volume_params: {
            chest: 36.4,
            waist: 30.8,
            low_hips: 37.9,
            abdomen: 32.1,
            neck: 15.3,
            thigh: 26.0,
            bicep: 13.0,
            wrist: 6.3
          },
          front_params: {
            shoulders: 16.2,
            sleeve_length: 21.2,
            inseam_from_crotch_to_floor: 27.5,
            inseam: 26.4,
            new_jacket_length: 29.4
          }
        }
      ],
      measurement_overrides: {}
    };
    
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
      
    if (!updateError && updatedProfile) {
      finalProfile = updatedProfile;
      console.log("Successfully auto-populated measurements!");
    }
  }
  
  return finalProfile;
}


// =============================================================
// Premium AI Tailor Dashboard Renderer & Tab Navigation
// =============================================================

function renderDashboardTwin(profile) {
  const grid = document.getElementById('db-measurements-grid');
  if (!grid) return;
  
  const measurements = [
    { key: 'chest', label: 'Chest / Bust 📏', value: profile.chest || '' },
    { key: 'waist', label: 'Waist 📏', value: profile.waist || '' },
    { key: 'belly', label: 'Belly 📏', value: profile.belly || '' },
    { key: 'hips', label: 'Hips 📏', value: profile.hips || '' },
    { key: 'height', label: 'Total Height 📏', value: profile.height || '', isHeight: true },
    { key: 'inseam', label: 'Inseam 📏', value: profile.inseam || '' }
  ];
  
  let html = '';
  measurements.forEach(m => {
    let valueHtml = '';
    if (m.isHeight) {
      const ft = m.value ? Math.floor(m.value / 12) : '';
      const inches = m.value ? Math.round(m.value % 12) : '';
      valueHtml = `
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="number" class="db-twin-input-ft" data-key="height-ft" value="${ft}" style="width: 60px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); padding: 8px; border-radius: 8px; color: #fff; text-align: center; outline: none; font-size: 0.95rem;" placeholder="ft" />
          <span style="color: var(--text-secondary); font-size: 0.9rem;">ft</span>
          <input type="number" class="db-twin-input-in" data-key="height-in" value="${inches}" style="width: 60px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); padding: 8px; border-radius: 8px; color: #fff; text-align: center; outline: none; font-size: 0.95rem;" placeholder="in" />
          <span style="color: var(--text-secondary); font-size: 0.9rem;">in</span>
        </div>
      `;
    } else {
      valueHtml = `
        <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
          <input type="number" step="0.1" class="db-twin-input" data-key="${m.key}" value="${m.value}" style="width: 100px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); padding: 8px; border-radius: 8px; color: #fff; text-align: center; outline: none; font-size: 0.95rem;" placeholder="N/A" />
          <span style="color: var(--text-secondary); font-size: 0.9rem;">inches</span>
        </div>
      `;
    }
    
    html += `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); font-family: var(--font-outfit);">${m.label}</span>
        ${valueHtml}
      </div>
    `;
  });
  
  grid.innerHTML = html;
}

function renderDashboardScans(profile) {
  const list = document.getElementById('db-scans-list');
  if (!list) return;
  
  const scans = profile.api_scans || [];
  if (scans.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; background: rgba(255,255,255,0.01); border: 1px dashed var(--border); border-radius: var(--radius-md);">
        <p style="font-size: 0.95rem; color: var(--text-secondary); margin: 0 0 1rem 0;">No 3D body scans saved yet.</p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Get your first body scan using our AI Body Scan tool on the landing page or the mobile widget!</p>
      </div>
    `;
    return;
  }
  
  const sortedScans = [...scans].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  let html = '';
  
  sortedScans.forEach(scan => {
    const dateStr = new Date(scan.timestamp).toLocaleString();
    const isActive = scan.is_active;
    const vp = scan.volume_params || {};
    const fp = scan.front_params || {};
    
    const chestVal = vp.chest ? vp.chest + '"' : 'N/A';
    const waistVal = vp.waist ? vp.waist + '"' : 'N/A';
    const hipsVal = vp.low_hips ? vp.low_hips + '"' : 'N/A';
    const heightVal = fp.body_height ? fp.body_height + '"' : 'N/A';
    
    html += `
      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem; transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--accent-light)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="flex: 1; min-width: 250px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 0.95rem; font-weight: 700; color: #fff;">Scan from ${dateStr}</span>
            ${isActive 
              ? `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.75rem; font-weight: 700; padding: 2px 10px; border-radius: 100px; border: 1px solid rgba(16, 185, 129, 0.25);">Active</span>` 
              : `<span style="background: rgba(255,255,255,0.05); color: var(--text-secondary); font-size: 0.75rem; font-weight: 700; padding: 2px 10px; border-radius: 100px; border: 1px solid var(--border);">Inactive</span>`
            }
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; line-height: 1.55;">
            <b>Dimensions:</b> Chest: ${chestVal} | Waist: ${waistVal} | Hips: ${hipsVal} | Height: ${heightVal}
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          ${!isActive 
            ? `<button class="btn-db-set-active" data-scan-id="${scan.scan_id}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Set Active</button>` 
            : ''
          }
          <button class="btn-db-delete" data-scan-id="${scan.scan_id}" style="background: transparent; border: none; color: #f87171; cursor: pointer; font-size: 0.85rem; font-weight: 600; padding: 6px; text-decoration: underline;" onmouseover="this.style.color='#fca5a5'" onmouseout="this.style.color='#f87171'">Delete</button>
        </div>
      </div>
    `;
  });
  
  list.innerHTML = html;
  
  // Bind click events
  list.querySelectorAll('.btn-db-set-active').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const scanId = e.currentTarget.getAttribute('data-scan-id');
      await setActiveScanInCloud(scanId);
    });
  });
  
  list.querySelectorAll('.btn-db-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const scanId = e.currentTarget.getAttribute('data-scan-id');
      if (confirm("Are you sure you want to delete this scan from your history?")) {
        await deleteScanFromCloud(scanId);
      }
    });
  });
}


// Global sync helpers
let syncTimeout = null;
async function syncMeasurementsToSupabase() {
  try {
    if (window.supabase) {
      const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const chest = document.getElementById('val-chest').value;
        const waist = document.getElementById('val-waist').value;
        const belly = document.getElementById('val-belly').value;
        const hips = document.getElementById('val-hips').value;
        const inseam = document.getElementById('val-inseam').value;
        
        const ftStr = document.getElementById('val-height-ft').value;
        const inStr = document.getElementById('val-height-in').value;
        let height = null;
        if (ftStr !== "" && inStr !== "") {
            height = (parseInt(ftStr, 10) * 12) + parseInt(inStr, 10);
        }
        
        const syncSpan = document.getElementById('cloud-sync-status') || document.querySelector('#logged-in-status span');
        if (syncSpan) {
          syncSpan.style.color = '#38bdf8'; // light blue
          syncSpan.innerHTML = 'Syncing...';
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            chest: chest ? parseFloat(chest) : null,
            waist: waist ? parseFloat(waist) : null,
            belly: belly ? parseFloat(belly) : null,
            hips: hips ? parseFloat(hips) : null,
            height: height ? parseFloat(height) : null,
            inseam: inseam ? parseFloat(inseam) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.user.id);
          
        if (error) throw error;
        
        if (syncSpan) {
          syncSpan.style.color = '#10b981'; // green
          syncSpan.innerHTML = '&#10004; Synced';
        }
        console.log("Successfully synced measurements to Supabase cloud.");
      }
    }
  } catch (err) {
    console.warn("Failed to sync measurements to Supabase:", err);
    const syncSpan = document.getElementById('cloud-sync-status') || document.querySelector('#logged-in-status span');
    if (syncSpan) {
      syncSpan.style.color = '#f87171'; // red
      syncSpan.innerHTML = '&#9888; Sync Failed';
    }
  }
}

function triggerSyncDebounce() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncMeasurementsToSupabase, 1500);
}

async function syncStoreScansToPortal(user, profile) {
  try {
    if (!window.supabase || !user || !user.email) return profile;
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const email = user.email.toLowerCase();
    const { data: storeProfile, error: fetchError } = await supabase
      .from('store_profiles')
      .select('api_scans, twin')
      .eq('username', email)
      .maybeSingle();
      
    if (fetchError) {
      console.warn("Error fetching store profile for sync:", fetchError);
      return profile;
    }
    
    if (storeProfile && storeProfile.api_scans && storeProfile.api_scans.length > 0) {
      console.log("Found store scans to sync:", storeProfile.api_scans);
      
      const portalScans = profile.api_scans || [];
      let mergedScans = [...portalScans];
      let updated = false;
      
      for (const scan of storeProfile.api_scans) {
        if (!mergedScans.some(s => s.scan_id === scan.scan_id || s.timestamp === scan.timestamp)) {
          mergedScans.push(scan);
          updated = true;
        }
      }
      
      if (updated) {
        mergedScans.forEach((s, idx) => {
          s.is_active = (idx === mergedScans.length - 1);
        });
        
        const activeScan = mergedScans.find(s => s.is_active);
        let chest = profile.chest;
        let waist = profile.waist;
        let belly = profile.belly;
        let hips = profile.hips;
        let height = profile.height;
        let inseam = profile.inseam;
        
        if (activeScan) {
          if (activeScan.volume_params.chest) chest = activeScan.volume_params.chest;
          if (activeScan.volume_params.waist) waist = activeScan.volume_params.waist;
          if (activeScan.volume_params.abdomen || activeScan.volume_params.waist) {
            belly = activeScan.volume_params.abdomen || activeScan.volume_params.waist;
          }
          if (activeScan.volume_params.low_hips) hips = activeScan.volume_params.low_hips;
          if (activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam) {
            inseam = activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam;
          }
          if (activeScan.front_params.body_height) {
            height = activeScan.front_params.body_height;
          }
        }
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            chest: chest ? parseFloat(chest) : null,
            waist: waist ? parseFloat(waist) : null,
            belly: belly ? parseFloat(belly) : null,
            hips: hips ? parseFloat(hips) : null,
            height: height ? parseFloat(height) : null,
            inseam: inseam ? parseFloat(inseam) : null,
            api_scans: mergedScans,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
          
        if (updateError) {
          console.error("Error updating portal profile during sync:", updateError);
        } else {
          console.log("Successfully synced scans from store_profiles to portal profile.");
          if (chest) document.getElementById('val-chest').value = chest;
          if (waist) document.getElementById('val-waist').value = waist;
          if (belly) document.getElementById('val-belly').value = belly;
          if (hips) document.getElementById('val-hips').value = hips;
          if (inseam) document.getElementById('val-inseam').value = inseam;
          if (height) {
            const ft = Math.floor(height / 12);
            const Math_round = Math.round(height % 12);
            document.getElementById('val-height-ft').value = ft;
            document.getElementById('val-height-in').value = Math_round;
          }
          localStorage.setItem('styla_twin_api_scans', JSON.stringify(mergedScans));
          if (chest) localStorage.setItem('styla_twin_chest', chest);
          if (waist) localStorage.setItem('styla_twin_waist', waist);
          if (belly) localStorage.setItem('styla_twin_belly', belly);
          if (hips) localStorage.setItem('styla_twin_hips', hips);
          if (height) localStorage.setItem('styla_twin_height', height);
          if (inseam) localStorage.setItem('styla_twin_inseam', inseam);
          
          profile.chest = chest;
          profile.waist = waist;
          profile.belly = belly;
          profile.hips = hips;
          profile.height = height;
          profile.inseam = inseam;
          profile.api_scans = mergedScans;
        }
      }
    }
  } catch (syncErr) {
    console.error("Failed to sync store scans to portal:", syncErr);
  }
  return profile;
}

function onUserLoggedIn(user, profile) {
  if (!profile) return;
  
  if (profile.chest) {
      document.getElementById('val-chest').value = profile.chest;
      localStorage.setItem('styla_twin_chest', profile.chest);
  }
  if (profile.waist) {
      document.getElementById('val-waist').value = profile.waist;
      localStorage.setItem('styla_twin_waist', profile.waist);
  }
  if (profile.belly) {
      document.getElementById('val-belly').value = profile.belly;
      localStorage.setItem('styla_twin_belly', profile.belly);
  }
  if (profile.hips) {
      document.getElementById('val-hips').value = profile.hips;
      localStorage.setItem('styla_twin_hips', profile.hips);
  }
  if (profile.inseam) {
      document.getElementById('val-inseam').value = profile.inseam;
      localStorage.setItem('styla_twin_inseam', profile.inseam);
  }
  if (profile.height) {
      const ft = Math.floor(profile.height / 12);
      const inches = Math.round(profile.height % 12);
      document.getElementById('val-height-ft').value = ft;
      document.getElementById('val-height-in').value = inches;
      localStorage.setItem('styla_twin_height', profile.height);
  }
  if (profile.api_scans) {
      localStorage.setItem('styla_twin_api_scans', JSON.stringify(profile.api_scans));
  } else {
      localStorage.removeItem('styla_twin_api_scans');
  }
  if (profile.measurement_overrides) {
      localStorage.setItem('styla_twin_measurement_overrides', JSON.stringify(profile.measurement_overrides));
  } else {
      localStorage.removeItem('styla_twin_measurement_overrides');
  }

  // Update UI to show they are logged in
  document.getElementById('btn-show-login').style.display = 'none';
  document.getElementById('logged-in-status').style.display = 'flex';
  
  const saveBox = document.getElementById('save-profile-box');
  if (saveBox) saveBox.style.display = 'none';
  
  const manageBox = document.getElementById('manage-profile-box');
  if (manageBox) {
      manageBox.style.display = 'block';
      const emailText = document.getElementById('profile-email-text');
      if (emailText) emailText.textContent = user.email;
  }

  const badge = document.getElementById('active-scan-badge');
  if (badge) {
      const activeScan = profile.api_scans && Array.isArray(profile.api_scans) ? profile.api_scans.find(s => s.is_active) : null;
      if (activeScan) {
          badge.style.display = 'block';
      } else {
          badge.style.display = 'none';
      }
  }
  
  renderScanHistory(profile);

  // Toggle from Landing page to Dashboard page
  const landingView = document.getElementById('landing-view');
  const dashboardView = document.getElementById('dashboard-view');
  if (landingView) landingView.style.display = 'none';
  if (dashboardView) dashboardView.style.display = 'block';

  // Populate Dashboard Header Email
  const dbUserEmailText = document.getElementById('db-user-email');
  if (dbUserEmailText) dbUserEmailText.textContent = user.email;

  // Render Dashboard contents
  renderDashboardTwin(profile);
  renderDashboardScans(profile);
}

function renderScanHistory(profile) {
  const scanList = document.getElementById('scan-history-list');
  if (!scanList) return;

  const scans = profile.api_scans || [];
  if (scans.length === 0) {
      scanList.innerHTML = '<p style="font-size: 0.85rem; color: #64748b; margin: 0;">No AI body scans saved yet.</p>';
      return;
  }

  // Sort scans: newest first
  const sortedScans = [...scans].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  let html = '';
  sortedScans.forEach(scan => {
      const dateStr = new Date(scan.timestamp).toLocaleString();
      const isActive = scan.is_active;
      const vp = scan.volume_params || {};
      const fp = scan.front_params || {};
      
      const chestVal = vp.chest ? vp.chest + '"' : 'N/A';
      const waistVal = vp.waist ? vp.waist + '"' : 'N/A';
      const hipsVal = vp.low_hips ? vp.low_hips + '"' : 'N/A';
      const heightVal = fp.body_height ? fp.body_height + '"' : 'N/A';
      
      html += `
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; transition: border-color 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.1)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.05)'">
          <div style="flex: 1; min-width: 200px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 0.85rem; font-weight: 600; color: #fff;">Scan from ${dateStr}</span>
              ${isActive 
                ? `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 100px; border: 1px solid rgba(16, 185, 129, 0.2);">Active</span>` 
                : `<span style="background: rgba(255,255,255,0.05); color: #94a3b8; font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 100px; border: 1px solid rgba(255,255,255,0.1);">Inactive</span>`
              }
            </div>
            <p style="font-size: 0.8rem; color: #94a3b8; margin: 0; line-height: 1.4;">
              <strong>Measurements:</strong> Chest: ${chestVal} | Waist: ${waistVal} | Hips: ${hipsVal} | Height: ${heightVal}
            </p>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${!isActive 
              ? `<button class="btn-set-active-scan" data-scan-id="${scan.scan_id}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Set Active</button>` 
              : ''
            }
            <button class="btn-delete-scan" data-scan-id="${scan.scan_id}" style="background: transparent; border: none; color: #f87171; cursor: pointer; font-size: 0.8rem; padding: 6px; text-decoration: underline;" onmouseover="this.style.color='#fca5a5'" onmouseout="this.style.color='#f87171'">Delete</button>
          </div>
        </div>
      `;
  });
  
  scanList.innerHTML = html;
  
  // Bind click events
  scanList.querySelectorAll('.btn-set-active-scan').forEach(btn => {
      btn.addEventListener('click', async (e) => {
          const scanId = e.currentTarget.getAttribute('data-scan-id');
          await setActiveScanInCloud(scanId);
      });
  });

  scanList.querySelectorAll('.btn-delete-scan').forEach(btn => {
      btn.addEventListener('click', async (e) => {
          const scanId = e.currentTarget.getAttribute('data-scan-id');
          if (confirm("Are you sure you want to delete this scan from your history?")) {
              await deleteScanFromCloud(scanId);
          }
      });
  });
}

async function setActiveScanInCloud(scanId) {
  try {
      if (!window.supabase) return;
      const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let scans = JSON.parse(localStorage.getItem('styla_twin_api_scans') || '[]');
      scans.forEach(s => {
          s.is_active = (s.scan_id === scanId);
      });
      
      localStorage.setItem('styla_twin_api_scans', JSON.stringify(scans));
      
      // Save to Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ api_scans: scans })
        .eq('id', session.user.id);
        
      if (error) throw error;
      
      // Find the new active scan to update inputs
      const activeScan = scans.find(s => s.is_active);
      if (activeScan) {
          if (activeScan.volume_params.chest) document.getElementById('val-chest').value = activeScan.volume_params.chest;
          if (activeScan.volume_params.waist) document.getElementById('val-waist').value = activeScan.volume_params.waist;
          if (activeScan.volume_params.abdomen || activeScan.volume_params.waist) {
              document.getElementById('val-belly').value = activeScan.volume_params.abdomen || activeScan.volume_params.waist;
          }
          if (activeScan.volume_params.low_hips) document.getElementById('val-hips').value = activeScan.volume_params.low_hips;
          if (activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam) {
              document.getElementById('val-inseam').value = activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam;
          }
          if (activeScan.front_params.body_height) {
              const ht = activeScan.front_params.body_height;
              const ft = Math.floor(ht / 12);
              const inches = Math.round(ht % 12);
              document.getElementById('val-height-ft').value = ft;
              document.getElementById('val-height-in').value = inches;
          }
          
          triggerSyncDebounce();
      }

      const badge = document.getElementById('active-scan-badge');
      if (badge) badge.style.display = activeScan ? 'block' : 'none';

      // Refresh UI
      const profile = await getOrCreateProfile(supabase, session.user);
      renderScanHistory(profile);
      
  } catch (err) {
      console.error("Failed to set active scan:", err);
      alert("Failed to set active scan: " + err.message);
  }
}

async function deleteScanFromCloud(scanId) {
  try {
      if (!window.supabase) return;
      const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let scans = JSON.parse(localStorage.getItem('styla_twin_api_scans') || '[]');
      const wasActive = scans.some(s => s.scan_id === scanId && s.is_active);
      
      scans = scans.filter(s => s.scan_id !== scanId);
      
      // If we deleted the active scan, and we still have other scans, make the newest one active
      if (wasActive && scans.length > 0) {
          scans[0].is_active = true;
      }
      
      localStorage.setItem('styla_twin_api_scans', JSON.stringify(scans));
      
      // Save to Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ api_scans: scans })
        .eq('id', session.user.id);
        
      if (error) throw error;
      
      // Refresh inputs if active scan changed
      const activeScan = scans.find(s => s.is_active);
      const badge = document.getElementById('active-scan-badge');
      if (badge) badge.style.display = activeScan ? 'block' : 'none';
      
      if (wasActive) {
          if (activeScan) {
              if (activeScan.volume_params.chest) document.getElementById('val-chest').value = activeScan.volume_params.chest;
              if (activeScan.volume_params.waist) document.getElementById('val-waist').value = activeScan.volume_params.waist;
              if (activeScan.volume_params.abdomen || activeScan.volume_params.waist) {
                  document.getElementById('val-belly').value = activeScan.volume_params.abdomen || activeScan.volume_params.waist;
              }
              if (activeScan.volume_params.low_hips) document.getElementById('val-hips').value = activeScan.volume_params.low_hips;
              if (activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam) {
                  document.getElementById('val-inseam').value = activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam;
              }
              if (activeScan.front_params.body_height) {
                  const ht = activeScan.front_params.body_height;
                  const ft = Math.floor(ht / 12);
                  const inches = Math.round(ht % 12);
                  document.getElementById('val-height-ft').value = ft;
                  document.getElementById('val-height-in').value = inches;
              }
          }
          triggerSyncDebounce();
      }

      // Refresh UI
      const profile = await getOrCreateProfile(supabase, session.user);
      renderScanHistory(profile);
      
  } catch (err) {
      console.error("Failed to delete scan:", err);
      alert("Failed to delete scan: " + err.message);
  }
}

// Load saved AI Tailor measurements on page load
window.addEventListener('DOMContentLoaded', async () => {
  // Set bookmarklet dynamically and setup copy button/toggle
  const btnBookmarklet = document.getElementById('btn-bookmarklet');
  const btnCopyBookmarklet = document.getElementById('btn-copy-bookmarklet');
  const lnkToggleMobile = document.getElementById('lnk-toggle-mobile');
  const mobilePanel = document.getElementById('mobile-instructions-panel');
  const copyMsg = document.getElementById('copy-success-msg');

  const bookmarkletHref = `javascript:(function(){const s=document.createElement('script');s.src='${window.location.origin}/tools/bookmarklet-script.js?t='+Date.now();document.body.appendChild(s);})();`;

  if (btnBookmarklet) {
      btnBookmarklet.setAttribute('href', bookmarkletHref);
      btnBookmarklet.addEventListener('click', (e) => {
        alert("To use STYLA on retail clothing stores, drag this button to your browser's Bookmarks Bar! (If you are on mobile, use the Mobile Guide below)");
      });
  }

  // Bind Dashboard Bookmarklet
  const dbBtnBookmarklet = document.getElementById('db-btn-bookmarklet');
  if (dbBtnBookmarklet) {
      dbBtnBookmarklet.setAttribute('href', bookmarkletHref);
  }

  const btnDbCopyBookmarklet = document.getElementById('btn-db-copy-bookmarklet');
  if (btnDbCopyBookmarklet) {
      btnDbCopyBookmarklet.addEventListener('click', () => {
          navigator.clipboard.writeText(bookmarkletHref);
          const dbCopyMsg = document.getElementById('db-copy-success-msg');
          if (dbCopyMsg) {
              dbCopyMsg.style.display = 'block';
              setTimeout(() => { dbCopyMsg.style.display = 'none'; }, 2000);
          }
      });
  }

  // Bind Dashboard tab navigation click handlers
  document.querySelectorAll('.db-nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.db-nav-item').forEach(item => {
        item.classList.remove('active');
        item.style.background = 'transparent';
        item.style.borderColor = 'transparent';
        item.style.color = 'var(--text-secondary)';
      });
      
      const clickedBtn = e.currentTarget;
      clickedBtn.classList.add('active');
      clickedBtn.style.background = 'var(--accent-dim)';
      clickedBtn.style.borderColor = 'var(--border-accent)';
      clickedBtn.style.color = '#fff';
      
      document.querySelectorAll('.db-tab-content').forEach(tab => {
        tab.style.display = 'none';
      });
      
      const tabId = clickedBtn.getAttribute('data-tab');
      const activeTab = document.getElementById(tabId);
      if (activeTab) activeTab.style.display = 'block';
    });
  });

  // Bind Dashboard Save Twin button
  const btnDbSaveTwin = document.getElementById('btn-db-save-twin');
  if (btnDbSaveTwin) {
    btnDbSaveTwin.addEventListener('click', async () => {
      btnDbSaveTwin.disabled = true;
      btnDbSaveTwin.textContent = "Saving...";
      
      try {
        if (!window.supabase) throw new Error("Supabase is not loaded.");
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No active session.");
        
        const updates = {};
        document.querySelectorAll('#db-measurements-grid .db-twin-input').forEach(input => {
          const key = input.getAttribute('data-key');
          const val = input.value.trim();
          updates[key] = val !== '' ? parseFloat(val) : null;
        });
        
        // Height
        const ftInput = document.querySelector('#db-measurements-grid .db-twin-input-ft');
        const inInput = document.querySelector('#db-measurements-grid .db-twin-input-in');
        if (ftInput && inInput) {
          const ft = ftInput.value.trim();
          const inch = inInput.value.trim();
          if (ft !== '' && inch !== '') {
            updates.height = (parseInt(ft, 10) * 12) + parseInt(inch, 10);
          } else {
            updates.height = null;
          }
        }
        
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', session.user.id);
          
        if (error) throw error;
        
        localStorage.setItem('styla_twin_chest', updates.chest || '');
        localStorage.setItem('styla_twin_waist', updates.waist || '');
        localStorage.setItem('styla_twin_belly', updates.belly || '');
        localStorage.setItem('styla_twin_hips', updates.hips || '');
        localStorage.setItem('styla_twin_height', updates.height || '');
        localStorage.setItem('styla_twin_inseam', updates.inseam || '');
        
        alert("Twin measurements successfully saved and synced to cloud!");
        
        const profile = await getOrCreateProfile(supabase, session.user);
        onUserLoggedIn(session.user, profile);
        
      } catch (err) {
        alert("Failed to save measurements: " + err.message);
      } finally {
        btnDbSaveTwin.disabled = false;
        btnDbSaveTwin.textContent = "Save Twin Measurements";
      }
    });
  }

  // Bind Dashboard Start 3D Scan button
  const btnDbStartScan = document.getElementById('btn-db-start-scan');
  if (btnDbStartScan) {
    btnDbStartScan.addEventListener('click', () => {
      const widgetBtn = document.querySelector('#saia-mtm-integration button, .saia-mtm-btn');
      if (widgetBtn) {
        widgetBtn.click();
      } else {
        alert("3D body scanner widget failed to initialize. Please try reloading the page.");
      }
    });
  }

  // Bind Dashboard Logout button
  const btnDbLogout = document.getElementById('btn-db-logout');
  if (btnDbLogout) {
    btnDbLogout.addEventListener('click', () => {
      const originalLogout = document.getElementById('btn-logout');
      if (originalLogout) originalLogout.click();
    });
  }

  // Bind Dashboard Settings actions (clear data, delete profile)
  const btnDbClearProfile = document.getElementById('btn-db-clear-profile');
  if (btnDbClearProfile) {
    btnDbClearProfile.addEventListener('click', () => {
      const originalBtn = document.getElementById('btn-clear-profile');
      if (originalBtn) originalBtn.click();
    });
  }

  const btnDbDeleteProfile = document.getElementById('btn-db-delete-profile');
  if (btnDbDeleteProfile) {
    btnDbDeleteProfile.addEventListener('click', () => {
      const originalBtn = document.getElementById('btn-delete-profile');
      if (originalBtn) originalBtn.click();
    });
  }

  // Bind Change Password settings form
  const btnDbChangePassword = document.getElementById('btn-db-change-password');
  if (btnDbChangePassword) {
    btnDbChangePassword.addEventListener('click', async () => {
      const password = document.getElementById('db-new-password').value;
      const confirmPassword = document.getElementById('db-confirm-password').value;
      const errorDiv = document.getElementById('db-settings-error');
      
      if (errorDiv) errorDiv.style.display = 'none';
      
      if (password.length < 6) {
        if (errorDiv) {
          errorDiv.textContent = "Password must be at least 6 characters.";
          errorDiv.style.display = 'block';
        }
        return;
      }
      if (password !== confirmPassword) {
        if (errorDiv) {
          errorDiv.textContent = "Passwords do not match.";
          errorDiv.style.display = 'block';
        }
        return;
      }
      
      btnDbChangePassword.disabled = true;
      btnDbChangePassword.textContent = "Updating...";
      
      try {
        if (!window.supabase) throw new Error("Supabase is not loaded.");
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { error } = await supabase.auth.updateUser({ password: password });
        if (error) throw error;
        
        alert("Password updated successfully!");
        document.getElementById('db-new-password').value = '';
        document.getElementById('db-confirm-password').value = '';
      } catch (err) {
        if (errorDiv) {
          errorDiv.textContent = err.message;
          errorDiv.style.display = 'block';
        }
      } finally {
        btnDbChangePassword.disabled = false;
        btnDbChangePassword.textContent = "Update Password";
      }
    });
  }

  if (lnkToggleMobile && mobilePanel) {
    lnkToggleMobile.addEventListener('click', (e) => {
      e.preventDefault();
      if (mobilePanel.style.display === 'none') {
        mobilePanel.style.display = 'block';
        lnkToggleMobile.textContent = '❌ Close Mobile Guide';
      } else {
        mobilePanel.style.display = 'none';
        lnkToggleMobile.textContent = '📱 Installing on Mobile? View Guide';
      }
    });
  }

  if (btnCopyBookmarklet) {
    btnCopyBookmarklet.addEventListener('click', () => {
      navigator.clipboard.writeText(bookmarkletHref).then(() => {
        if (copyMsg) {
          copyMsg.style.display = 'block';
          setTimeout(() => {
            copyMsg.style.display = 'none';
          }, 3000);
        }
      }).catch(err => {
        alert("Failed to copy code: " + err);
      });
    });
  }

  const savedChest = localStorage.getItem('styla_twin_chest');
  const savedWaist = localStorage.getItem('styla_twin_waist');
  const savedBelly = localStorage.getItem('styla_twin_belly');
  const savedHips = localStorage.getItem('styla_twin_hips');
  const savedHeight = localStorage.getItem('styla_twin_height'); // Total inches
  const savedInseam = localStorage.getItem('styla_twin_inseam');

  if (savedChest) document.getElementById('val-chest').value = savedChest;
  if (savedWaist) document.getElementById('val-waist').value = savedWaist;
  if (savedBelly) document.getElementById('val-belly').value = savedBelly;
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
              const profile = await getOrCreateProfile(supabase, session.user);
              onUserLoggedIn(session.user, profile);
          }
      }
  } catch (err) {
      console.log("Supabase session check skipped or failed.", err);
  }



  // Auto-save measurements to localStorage on input change
  const inputsToWatch = [
    { id: "val-chest", key: "styla_twin_chest" },
    { id: "val-waist", key: "styla_twin_waist" },
    { id: "val-belly", key: "styla_twin_belly" },
    { id: "val-hips", key: "styla_twin_hips" },
    { id: "val-inseam", key: "styla_twin_inseam" }
  ];

  inputsToWatch.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener("input", (e) => {
        localStorage.setItem(item.key, e.target.value);
        triggerSyncDebounce();
      });
    }
  });

  // Watch height selectors
  const ftEl = document.getElementById("val-height-ft");
  const inEl = document.getElementById("val-height-in");
  function saveHeight() {
    const ftStr = ftEl.value;
    const inStr = inEl.value;
    if (ftStr !== "" && inStr !== "") {
      const height = (parseInt(ftStr, 10) * 12) + parseInt(inStr, 10);
      localStorage.setItem("styla_twin_height", height);
      triggerSyncDebounce();
    }
  }
  if (ftEl) ftEl.addEventListener("change", saveHeight);
  if (inEl) inEl.addEventListener("change", saveHeight);

  // Deep-link auto signup or reset checks
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  if (action === 'signup') {
      const modal = document.getElementById('login-modal');
      if (modal) {
          modal.style.display = 'flex';
          switchToSignup();
      }
  } else if (action === 'reset') {
      const modal = document.getElementById('login-modal');
      if (modal) {
          modal.style.display = 'flex';
          switchToReset();
      }
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
    waist: { text: "Measure around your natural waistline, keeping the tape comfortably snug.", img: "images/measure_waist.png" },
    belly: { text: "Measure around the fullest part of your abdomen (belly), usually at the level of the belly button (navel). A critical measurement for shirts, tops, and outerwear.", img: "images/measure_belly.png" },
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

function compressImage(file, maxDimension = 1024, quality = 0.7) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.readAsDataURL(file);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleChartFiles(files) {
    if (!files || files.length === 0) return;
    
    dropText.style.display = 'none';
    if (chartPreviewContainer) chartPreviewContainer.innerHTML = '';
    chartBase64Images = [];
    
    for (const file of Array.from(files)) {
        try {
            const base64 = await compressImage(file);
            chartBase64Images.push(base64);
            
            const img = document.createElement('img');
            img.src = base64;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid rgba(255,255,255,0.2)';
            if (chartPreviewContainer) chartPreviewContainer.appendChild(img);
        } catch (err) {
            console.error("Error compressing file:", err);
        }
    }
}

async function handleStyleFiles(files) {
    if (!files || files.length === 0) return;
    
    styleDropText.style.display = 'none';
    if (stylePreviewContainer) stylePreviewContainer.innerHTML = '';
    styleBase64Images = [];
    
    for (const file of Array.from(files)) {
        try {
            const base64 = await compressImage(file);
            styleBase64Images.push(base64);
            
            const img = document.createElement('img');
            img.src = base64;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid rgba(255,255,255,0.2)';
            if (stylePreviewContainer) stylePreviewContainer.appendChild(img);
        } catch (err) {
            console.error("Error compressing file:", err);
        }
    }
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
  const belly = document.getElementById('val-belly').value;
  const hips = document.getElementById('val-hips').value;
  const inseam = document.getElementById('val-inseam').value;
  
  const ftStr = document.getElementById('val-height-ft').value;
  const inStr = document.getElementById('val-height-in').value;
  let height = "";
  if (ftStr !== "" && inStr !== "") {
      height = (parseInt(ftStr, 10) * 12) + parseInt(inStr, 10);
  }

  if (!chest || !waist || !belly || !hips) {
    alert("Please enter at least Chest, Waist, Belly, and Hips.");
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
  localStorage.setItem('styla_twin_belly', belly);
  localStorage.setItem('styla_twin_hips', hips);
  if(height) localStorage.setItem('styla_twin_height', height);
  if(inseam) localStorage.setItem('styla_twin_inseam', inseam);

  startLoader();

  let api_scans = [];
  try {
    const rawScans = localStorage.getItem('styla_twin_api_scans');
    if (rawScans) api_scans = JSON.parse(rawScans);
  } catch (e) {}

  let measurement_overrides = {};
  try {
    const rawOverrides = localStorage.getItem('styla_twin_measurement_overrides');
    if (rawOverrides) measurement_overrides = JSON.parse(rawOverrides);
  } catch (e) {}

  try {
    const res = await fetch('/api/decode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chest, waist, belly, hips, height, inseam,
        api_scans,
        measurement_overrides,
        chartImagesBase64: chartBase64Images,
        styleImagesBase64: styleBase64Images
      })
    });

    const data = await res.json();
    stopLoader();

    if (res.ok) {
        let fitHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 1.5rem; font-weight: bold; color: #ff2a75;">
              \u2728 Recommended Size: ${data.recommended_size}
            </div>
            ${data.fit_match_score !== undefined && data.fit_match_score !== null ? `
            <div style="display: flex; flex-direction: column; align-items: flex-end;">
              <span style="font-size: 0.7rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Fit Match Score</span>
              <span style="font-size: 1.5rem; font-weight: bold; color: ${data.fit_match_score >= 85 ? '#10b981' : data.fit_match_score >= 70 ? '#f59e0b' : '#ef4444'};">${data.fit_match_score}%</span>
            </div>
            ` : ''}
          </div>
          
          ${data.fit_spectrum ? `
          <!-- Fit Spectrum Slider -->
          <div style="margin: 1rem 0; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px; text-align: center;">Fit Spectrum</div>
            <div style="position: relative; height: 6px; background: linear-gradient(90deg, #ef4444 0%, #f59e0b 25%, #10b981 50%, #f59e0b 75%, #ef4444 100%); border-radius: 3px; margin: 8px 4px;">
              <div style="position: absolute; top: -5px; left: ${
                data.fit_spectrum.toLowerCase() === 'tight' ? '8%' :
                data.fit_spectrum.toLowerCase() === 'slim' ? '30%' :
                data.fit_spectrum.toLowerCase() === 'ideal' ? '50%' :
                (data.fit_spectrum.toLowerCase() === 'relaxed' || data.fit_spectrum.toLowerCase() === 'loose') ? '70%' :
                data.fit_spectrum.toLowerCase() === 'oversized' ? '92%' : '50%'
              }; width: 14px; height: 14px; background: #fff; border: 2.5px solid #ff2a75; border-radius: 50%; transform: translateX(-50%); box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; padding: 0 2px;">
              <span>Tight</span>
              <span>Slim</span>
              <span style="color: #10b981;">Ideal</span>
              <span>Loose</span>
              <span>Oversized</span>
            </div>
          </div>
          ` : ''}

          <p style="margin-bottom: 1rem; font-size: 1rem; line-height: 1.5;">${data.explanation}</p>
        `;

        if (data.warning && data.warning.toLowerCase() !== "none" && data.warning.trim() !== "") {
            fitHtml += `
            <div style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; color: #fca5a5;">
              <strong>\u26A0\uFE0F Warning:</strong> ${data.warning}
            </div>`;
        }

        if (data.fit_breakdown) {
            fitHtml += `<h4 style="margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">Fit Breakdown</h4>`;
            fitHtml += `<ul style="list-style-type: none; padding-left: 0;">`;
            for (const [part, desc] of Object.entries(data.fit_breakdown)) {
                let icon = "\uD83D\uDCCF";
                if (desc.toLowerCase().includes("tight") || desc.toLowerCase().includes("small")) icon = "\uD83D\uDD34";
                if (desc.toLowerCase().includes("perfect") || desc.toLowerCase().includes("great")) icon = "\uD83D\uDFE2";
                if (desc.toLowerCase().includes("relaxed") || desc.toLowerCase().includes("large") || desc.toLowerCase().includes("oversized")) icon = "\uD83D\uDD35";
                
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
        
        // Show the Chat Section and initialize its history context
        const activeChatSection = document.getElementById('chat-section');
        const activeChatMessages = document.getElementById('chat-messages');
        
        if (activeChatSection) {
            activeChatSection.style.display = 'block';
            
            const initialAnalysis = "Here is the garment sizing analysis for my measurements (Chest: " + chest + "\", Waist: " + waist + "\", Hips: " + hips + "\"): Recommended size is " + data.recommended_size + ". Fit breakdown: Chest is " + (data.fit_breakdown?.chest || '') + ", Waist is " + (data.fit_breakdown?.waist || '') + ", Hips is " + (data.fit_breakdown?.hips || '') + ". Explanation: " + data.explanation;
            const assistantGreeting = "I've analyzed your fit and recommended size " + data.recommended_size + ". Have any questions about the sizing, fit details, or alterations for this item?";
            
            chatHistory = [
              { role: "user", parts: [{ text: initialAnalysis }] },
              { role: "model", parts: [{ text: assistantGreeting }] }
            ];
            
            if (activeChatMessages) {
                activeChatMessages.innerHTML = '';
                const greetingDiv = document.createElement('div');
                greetingDiv.style.cssText = 'align-self: flex-start; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 12px; max-width: 85%; color: #f0f0ff; border: 1px solid rgba(255, 255, 255, 0.05); border-bottom-left-radius: 2px;';
                greetingDiv.textContent = "I've analyzed your fit and recommended size " + data.recommended_size + ". Have any questions about the sizing, fit details, or alterations for this item?";
                activeChatMessages.appendChild(greetingDiv);
            }
        }
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
  const belly = document.getElementById('val-belly').value;
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
              emailRedirectTo: window.location.origin + '/index.html',
              data: {
                  chest: chest,
                  waist: waist,
                  belly: belly,
                  hips: hips,
                  height: height || null,
                  inseam: inseam || null
              }
          }
      });

      if (error) throw error;
      
      btnSaveProfile.textContent = "\u2714 Profile Saved to Cloud!";
      btnSaveProfile.style.background = "#10b981";
      
      // Also update the header UI immediately
      document.getElementById('btn-show-login').style.display = 'none';
      document.getElementById('logged-in-status').style.display = 'flex';
      
  } catch (err) {
      let msg = err?.message || err?.error_description || (typeof err === 'object' ? (JSON.stringify(err) === '{}' ? String(err) : JSON.stringify(err)) : String(err));
      if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) {
          msg = "Failed to connect to the cloud database. If this is a free-tier Supabase project, it may have been automatically paused due to inactivity. Please log in to your Supabase dashboard at supabase.com and click 'Resume' to restore it.";
      }
      alert("Error: " + msg);
      btnSaveProfile.textContent = "Save Profile to Cloud";
      btnSaveProfile.disabled = false;
  }
});

// -----------------------------------------
// Login & Logout Handlers
// -----------------------------------------

window.togglePasswordVisibility = function(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            btnEl.style.opacity = '1';
        } else {
            input.type = 'password';
            btnEl.style.opacity = '0.5';
        }
    }
}

const btnShowLogin = document.getElementById('btn-show-login');
const btnLoginSubmit = document.getElementById('btn-login-submit');
const btnLogout = document.getElementById('btn-logout');
const loginModal = document.getElementById('login-modal');
const loginError = document.getElementById('login-error');

const tabAuthLogin = document.getElementById('tab-auth-login');
const tabAuthSignup = document.getElementById('tab-auth-signup');
const authModalTitle = document.getElementById('auth-modal-title');
const authModalDesc = document.getElementById('auth-modal-desc');
const btnSignupSubmit = document.getElementById('btn-signup-submit');

const authTabsContainer = document.getElementById('auth-tabs-container');
const authEmailContainer = document.getElementById('auth-email-container');
const authPasswordContainer = document.getElementById('auth-password-container');
const authConfirmContainer = document.getElementById('auth-confirm-container');

const btnForgotSubmit = document.getElementById('btn-forgot-submit');
const btnResetSubmit = document.getElementById('btn-reset-submit');

const linkForgotPassword = document.getElementById('link-forgot-password');
const linkBackLogin = document.getElementById('link-back-login');

function switchToLogin() {
    if (authTabsContainer) authTabsContainer.style.display = 'flex';
    if (authModalTitle) authModalTitle.textContent = "Welcome Back";
    if (authModalDesc) authModalDesc.textContent = "Log in to sync your AI Tailor measurements from the cloud.";
    
    if (authEmailContainer) authEmailContainer.style.display = 'block';
    if (authPasswordContainer) authPasswordContainer.style.display = 'block';
    if (authConfirmContainer) authConfirmContainer.style.display = 'none';
    
    if (tabAuthLogin) tabAuthLogin.classList.add('active');
    if (tabAuthSignup) tabAuthSignup.classList.remove('active');
    
    if (btnLoginSubmit) btnLoginSubmit.style.display = 'block';
    if (btnSignupSubmit) btnSignupSubmit.style.display = 'none';
    if (btnForgotSubmit) btnForgotSubmit.style.display = 'none';
    if (btnResetSubmit) btnResetSubmit.style.display = 'none';
    
    if (linkForgotPassword) linkForgotPassword.style.display = 'block';
    if (linkBackLogin) linkBackLogin.style.display = 'none';
    if (loginError) loginError.style.display = 'none';
}

function switchToSignup() {
    if (authTabsContainer) authTabsContainer.style.display = 'flex';
    if (authModalTitle) authModalTitle.textContent = "Create Account";
    if (authModalDesc) authModalDesc.textContent = "Create a free cloud profile to save your AI Tailor measurements.";
    
    if (authEmailContainer) authEmailContainer.style.display = 'block';
    if (authPasswordContainer) authPasswordContainer.style.display = 'block';
    if (authConfirmContainer) authConfirmContainer.style.display = 'block';
    
    if (tabAuthLogin) tabAuthLogin.classList.remove('active');
    if (tabAuthSignup) tabAuthSignup.classList.add('active');
    
    if (btnLoginSubmit) btnLoginSubmit.style.display = 'none';
    if (btnSignupSubmit) btnSignupSubmit.style.display = 'block';
    if (btnForgotSubmit) btnForgotSubmit.style.display = 'none';
    if (btnResetSubmit) btnResetSubmit.style.display = 'none';
    
    if (linkForgotPassword) linkForgotPassword.style.display = 'none';
    if (linkBackLogin) linkBackLogin.style.display = 'none';
    if (loginError) loginError.style.display = 'none';
}

function switchToForgot() {
    if (authTabsContainer) authTabsContainer.style.display = 'none';
    if (authModalTitle) authModalTitle.textContent = "Reset Password";
    if (authModalDesc) authModalDesc.textContent = "Enter your email address and we will send you a link to reset your password.";
    
    if (authEmailContainer) authEmailContainer.style.display = 'block';
    if (authPasswordContainer) authPasswordContainer.style.display = 'none';
    if (authConfirmContainer) authConfirmContainer.style.display = 'none';
    
    if (btnLoginSubmit) btnLoginSubmit.style.display = 'none';
    if (btnSignupSubmit) btnSignupSubmit.style.display = 'none';
    if (btnForgotSubmit) btnForgotSubmit.style.display = 'block';
    if (btnResetSubmit) btnResetSubmit.style.display = 'none';
    
    if (linkForgotPassword) linkForgotPassword.style.display = 'none';
    if (linkBackLogin) linkBackLogin.style.display = 'block';
    if (loginError) loginError.style.display = 'none';
}

function switchToReset() {
    if (authTabsContainer) authTabsContainer.style.display = 'none';
    if (authModalTitle) authModalTitle.textContent = "Set New Password";
    if (authModalDesc) authModalDesc.textContent = "Please enter and confirm your new password.";
    
    if (authEmailContainer) authEmailContainer.style.display = 'none';
    if (authPasswordContainer) authPasswordContainer.style.display = 'block';
    if (authConfirmContainer) authConfirmContainer.style.display = 'block';
    
    if (btnLoginSubmit) btnLoginSubmit.style.display = 'none';
    if (btnSignupSubmit) btnSignupSubmit.style.display = 'none';
    if (btnForgotSubmit) btnForgotSubmit.style.display = 'none';
    if (btnResetSubmit) btnResetSubmit.style.display = 'block';
    
    if (linkForgotPassword) linkForgotPassword.style.display = 'none';
    if (linkBackLogin) linkBackLogin.style.display = 'none';
    if (loginError) loginError.style.display = 'none';
}

if (tabAuthLogin) tabAuthLogin.addEventListener('click', switchToLogin);
if (tabAuthSignup) tabAuthSignup.addEventListener('click', switchToSignup);
if (linkForgotPassword) {
    linkForgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        switchToForgot();
    });
}
if (linkBackLogin) {
    linkBackLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchToLogin();
    });
}

if (btnShowLogin) {
    btnShowLogin.addEventListener('click', () => {
        loginModal.style.display = 'flex';
        switchToLogin();
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
            const profile = await getOrCreateProfile(supabase, data.user);
            onUserLoggedIn(data.user, profile);
            
            // Update UI
            loginModal.style.display = 'none';
            
        } catch (err) {
            let msg = err?.message || err?.error_description || (typeof err === 'object' ? (JSON.stringify(err) === '{}' ? String(err) : JSON.stringify(err)) : String(err));
            if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) {
                msg = "Failed to connect to the cloud database. If this is a free-tier Supabase project, it may have been automatically paused due to inactivity. Please log in to your Supabase dashboard at supabase.com and click 'Resume' to restore it.";
            }
            loginError.textContent = msg;
            loginError.style.display = 'block';
        } finally {
            btnLoginSubmit.disabled = false;
            btnLoginSubmit.textContent = "Log In & Sync";
        }
    });
}

if (btnSignupSubmit) {
    btnSignupSubmit.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const confirmPassword = document.getElementById('login-confirm-password').value;
        
        if (!email) {
            loginError.textContent = "Please enter a valid email address.";
            loginError.style.display = 'block';
            return;
        }
        if (password.length < 6) {
            loginError.textContent = "Password must be at least 6 characters.";
            loginError.style.display = 'block';
            return;
        }
        if (password !== confirmPassword) {
            loginError.textContent = "Passwords do not match.";
            loginError.style.display = 'block';
            return;
        }
        
        btnSignupSubmit.disabled = true;
        btnSignupSubmit.textContent = "Creating Account...";
        loginError.style.display = 'none';

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
            if (!window.supabase) throw new Error("Supabase is not loaded.");
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: window.location.origin + '/index.html',
                    data: {
                        chest: chest || null,
                        waist: waist || null,
                        hips: hips || null,
                        height: height || null,
                        inseam: inseam || null
                    }
                }
            });
            
            if (error) throw error;
            
            // Close modal
            loginModal.style.display = 'none';
            
            if (data && data.session) {
                const profile = await getOrCreateProfile(supabase, data.user);
                onUserLoggedIn(data.user, profile);
                alert("Account created and profile saved successfully!");
            } else {
                alert("Account created! A confirmation email has been sent. Please confirm your email to activate your account.");
            }
            
        } catch (err) {
            let msg = err?.message || err?.error_description || (typeof err === 'object' ? (JSON.stringify(err) === '{}' ? String(err) : JSON.stringify(err)) : String(err));
            if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) {
                msg = "Failed to connect to the cloud database. If this is a free-tier Supabase project, it may have been automatically paused due to inactivity. Please log in to your Supabase dashboard at supabase.com and click 'Resume' to restore it.";
            }
            loginError.textContent = msg;
            loginError.style.display = 'block';
        } finally {
            btnSignupSubmit.disabled = false;
            btnSignupSubmit.textContent = "Create Account & Sync";
        }
    });
}

if (btnForgotSubmit) {
    btnForgotSubmit.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        if (!email) {
            loginError.textContent = "Please enter your email address.";
            loginError.style.display = 'block';
            return;
        }
        
        btnForgotSubmit.disabled = true;
        btnForgotSubmit.textContent = "Sending Link...";
        loginError.style.display = 'none';
        
        try {
            if (!window.supabase) throw new Error("Supabase is not loaded.");
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/index.html?action=reset',
            });
            
            if (error) throw error;
            
            alert("Password reset email sent! Please check your inbox for the reset link.");
            loginModal.style.display = 'none';
        } catch (err) {
            let msg = err?.message || err?.error_description || (typeof err === 'object' ? (JSON.stringify(err) === '{}' ? String(err) : JSON.stringify(err)) : String(err));
            if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) {
                msg = "Failed to connect to the cloud database. If this is a free-tier Supabase project, it may have been automatically paused due to inactivity. Please log in to your Supabase dashboard at supabase.com and click 'Resume' to restore it.";
            }
            loginError.textContent = msg;
            loginError.style.display = 'block';
        } finally {
            btnForgotSubmit.disabled = false;
            btnForgotSubmit.textContent = "Send Reset Link";
        }
    });
}

if (btnResetSubmit) {
    btnResetSubmit.addEventListener('click', async () => {
        const password = document.getElementById('login-password').value;
        const confirmPassword = document.getElementById('login-confirm-password').value;
        
        if (password.length < 6) {
            loginError.textContent = "Password must be at least 6 characters.";
            loginError.style.display = 'block';
            return;
        }
        if (password !== confirmPassword) {
            loginError.textContent = "Passwords do not match.";
            loginError.style.display = 'block';
            return;
        }
        
        btnResetSubmit.disabled = true;
        btnResetSubmit.textContent = "Updating Password...";
        loginError.style.display = 'none';
        
        try {
            if (!window.supabase) throw new Error("Supabase is not loaded.");
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            
            const { error } = await supabase.auth.updateUser({
                password: password
            });
            
            if (error) throw error;
            
            alert("Password updated successfully! You are now logged in.");
            loginModal.style.display = 'none';
            
            // Check session and update UI
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                document.getElementById('btn-show-login').style.display = 'none';
                document.getElementById('logged-in-status').style.display = 'flex';
                document.getElementById('save-profile-box').style.display = 'none';
            }
        } catch (err) {
            let msg = err?.message || err?.error_description || (typeof err === 'object' ? (JSON.stringify(err) === '{}' ? String(err) : JSON.stringify(err)) : String(err));
            if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) {
                msg = "Failed to connect to the cloud database. If this is a free-tier Supabase project, it may have been automatically paused due to inactivity. Please log in to your Supabase dashboard at supabase.com and click 'Resume' to restore it.";
            }
            loginError.textContent = msg;
            loginError.style.display = 'block';
        } finally {
            btnResetSubmit.disabled = false;
            btnResetSubmit.textContent = "Update Password";
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
            localStorage.removeItem('styla_twin_api_scans');
            localStorage.removeItem('styla_twin_measurement_overrides');
            const badge = document.getElementById('active-scan-badge');
            if (badge) badge.style.display = 'none';

            // Reset UI
            document.getElementById('btn-show-login').style.display = 'block';
            document.getElementById('logged-in-status').style.display = 'none';
            
            const manageBox = document.getElementById('manage-profile-box');
            if (manageBox) manageBox.style.display = 'none';
            
            // Toggle view back to Landing page
            const landingView = document.getElementById('landing-view');
            const dashboardView = document.getElementById('dashboard-view');
            if (landingView) landingView.style.display = 'block';
            if (dashboardView) dashboardView.style.display = 'none';
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









// ==========================================
// AI CHAT WIDGET LOGIC
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    if (chatSendBtn && chatInput && chatMessages) {
      const sendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = '';

        // Append user message to UI
        appendMessage(text, 'user');

        // Add to history
        chatHistory.push({ role: 'user', parts: [{ text: text }] });

        // Show typing indicator
        const typingIndicator = appendMessage('Thinking...', 'model', true);

        try {
          const chest = document.getElementById('val-chest').value;
          const waist = document.getElementById('val-waist').value;
          const belly = document.getElementById('val-belly').value;
          const hips = document.getElementById('val-hips').value;

          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              chest,
              waist,
              belly,
              hips,
              history: chatHistory
            })
          });

          // Remove typing indicator
          if (typingIndicator) typingIndicator.remove();

          if (res.ok) {
            const data = await res.json();
            const reply = data.reply;

            // Append assistant response to UI
            appendMessage(reply, 'model');

            // Add assistant response to history
            chatHistory.push({ role: 'model', parts: [{ text: reply }] });
          } else {
            const errData = await res.json();
            appendMessage("Error: " + (errData.error || 'Server error'), 'model');
          }
        } catch (err) {
          console.error("Chat network error:", err);
          if (typingIndicator) typingIndicator.remove();
          appendMessage("Network error. Please try again.", 'model');
        }
      };

      chatSendBtn.addEventListener('click', sendMessage);
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
    }

    function appendMessage(text, role, isTyping = false) {
      if (!chatMessages) return null;
      const msgDiv = document.createElement('div');
      
      if (role === 'user') {
        msgDiv.style.cssText = 'align-self: flex-end; background: linear-gradient(135deg, #ff2a75 0%, #d90040 100%); padding: 8px 12px; border-radius: 12px; border-bottom-right-radius: 2px; max-width: 85%; color: #fff; word-break: break-word; box-shadow: 0 2px 8px rgba(255, 42, 117, 0.15); font-size: 0.9rem;';
      } else {
        msgDiv.style.cssText = 'align-self: flex-start; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 12px; border-bottom-left-radius: 2px; max-width: 85%; color: #f0f0ff; border: 1px solid rgba(255,255,255,0.05); word-break: break-word; font-size: 0.9rem;';
        if (isTyping) {
          msgDiv.style.opacity = '0.7';
          msgDiv.style.fontStyle = 'italic';
        }
      }
      
            msgDiv.textContent = text;
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return msgDiv;
    }

    // Estimator Modal Handling
    const btnRunEstimate = document.getElementById('btn-run-estimate');
    if (btnRunEstimate) {
      btnRunEstimate.addEventListener('click', async () => {
        const heightFeet = document.getElementById('est-height-ft').value;
        const heightInches = document.getElementById('est-height-in').value;
        const weight = document.getElementById('est-weight').value;
        const age = document.getElementById('est-age').value;
        const bellyShape = document.getElementById('est-belly').value;
        const hipShape = document.getElementById('est-hips').value;
        const fitPreference = document.getElementById('est-fit').value;
        const estError = document.getElementById('est-error');

        if (!weight || !age) {
          estError.textContent = "Please fill in both Weight and Age.";
          estError.style.display = "block";
          return;
        }

        estError.style.display = "none";
        btnRunEstimate.disabled = true;
        btnRunEstimate.textContent = "Estimating measurements...";

        try {
          const res = await fetch('/api/estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ heightFeet, heightInches, weight, age, bellyShape, hipShape, fitPreference })
          });

          const data = await res.json();
          btnRunEstimate.disabled = false;
          btnRunEstimate.textContent = "Generate AI Tailor Specs";

          if (res.ok) {
            // Set input values
            document.getElementById('val-chest').value = data.chest;
            document.getElementById('val-waist').value = data.waist;
            document.getElementById('val-belly').value = data.belly;
            document.getElementById('val-hips').value = data.hips;
            document.getElementById('val-inseam').value = data.inseam;
            document.getElementById('val-height-ft').value = heightFeet;
            document.getElementById('val-height-in').value = heightInches;

            // Save to localStorage
            localStorage.setItem('styla_twin_chest', data.chest);
            localStorage.setItem('styla_twin_waist', data.waist);
            localStorage.setItem('styla_twin_belly', data.belly);
            localStorage.setItem('styla_twin_hips', data.hips);
            localStorage.setItem('styla_twin_inseam', data.inseam);
            localStorage.setItem('styla_twin_height', data.height);

            // Display disclaimer banner
            const banner = document.getElementById('accuracy-warning-banner');
            if (banner) banner.style.display = 'flex';

            // Close modal
            document.getElementById('estimate-modal').style.display = 'none';

            // Trigger sync to Supabase if logged in
            if (typeof triggerSyncDebounce === 'function') {
              triggerSyncDebounce();
            }
          } else {
            estError.textContent = data.error || "Estimation failed.";
            estError.style.display = "block";
          }
        } catch (err) {
                    btnRunEstimate.disabled = false;
          btnRunEstimate.textContent = "Generate AI Tailor Specs";
          estError.textContent = "Network error occurred.";
          estError.style.display = "block";
          console.error(err);
        }
      });
    }

    // Brand Size Estimator Handling
    const btnRunBrandEstimate = document.getElementById('btn-run-brand-estimate');
    if (btnRunBrandEstimate) {
      btnRunBrandEstimate.addEventListener('click', async () => {
        const estError = document.getElementById('est-error');
        const brandLoader = document.getElementById('brand-loader');
        
        const gender = document.getElementById('est-brand-gender').value;
        const heightFeet = document.getElementById('est-brand-height-ft').value;
        const heightInches = document.getElementById('est-brand-height-in').value;
        const weight = document.getElementById('est-brand-weight').value;

        if (!weight) {
          estError.textContent = "Please enter your weight.";
          estError.style.display = "block";
          return;
        }

        estError.style.display = "none";
        btnRunBrandEstimate.style.display = "none";
        if (brandLoader) {
          brandLoader.style.display = "block";
        }

        const payload = {
          gender,
          heightFeet,
          heightInches,
          weight,
          maleApparel: document.getElementById('est-brand-male-apparel').value,
          maleSize: document.getElementById('est-brand-male-size').value,
          maleBrand: document.getElementById('est-brand-male-brand').value,
          maleFit: document.getElementById('est-brand-male-fit').value,
          maleWaist: document.getElementById('est-brand-male-waist').value,
          maleLength: document.getElementById('est-brand-male-length').value,
          femaleDress: document.getElementById('est-brand-female-dress').value,
          femalePants: document.getElementById('est-brand-female-pants').value,
          femaleBrand: document.getElementById('est-brand-female-brand').value,
          femaleFit: document.getElementById('est-brand-female-fit').value
        };

        try {
          const res = await fetch('/api/estimate-brand', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          if (brandLoader) {
            brandLoader.style.display = "none";
          }
          btnRunBrandEstimate.style.display = "block";

          if (res.ok) {
            // Set inputs on main page
            document.getElementById('val-chest').value = data.chest;
            document.getElementById('val-waist').value = data.waist;
            document.getElementById('val-belly').value = data.belly;
            document.getElementById('val-hips').value = data.hips;
            document.getElementById('val-inseam').value = data.inseam;
            document.getElementById('val-height-ft').value = heightFeet;
            document.getElementById('val-height-in').value = heightInches;

            // Save to localStorage
            localStorage.setItem('styla_twin_chest', data.chest);
            localStorage.setItem('styla_twin_waist', data.waist);
            localStorage.setItem('styla_twin_belly', data.belly);
            localStorage.setItem('styla_twin_hips', data.hips);
            localStorage.setItem('styla_twin_inseam', data.inseam);
            localStorage.setItem('styla_twin_height', data.height);

            // Display disclaimer banner
            const banner = document.getElementById('accuracy-warning-banner');
            if (banner) {
              banner.style.display = 'flex';
              banner.querySelector('div').innerHTML = `
                <strong>Estimated Twin Active:</strong> These measurements are estimated via Brand Sizing. For 95%+ accuracy, using a tape to provide those measurements works better.
              `;
            }

            // Close modal
            document.getElementById('estimate-modal').style.display = 'none';

            // Trigger sync
            if (typeof triggerSyncDebounce === 'function') {
              triggerSyncDebounce();
            }
          } else {
            estError.textContent = data.error || "Estimation failed.";
            estError.style.display = "block";
          }

        } catch (err) {
          if (brandLoader) {
            brandLoader.style.display = "none";
          }
          btnRunBrandEstimate.style.display = "block";
          estError.textContent = "Network error occurred.";
          estError.style.display = "block";
          console.error(err);
        }
      });
    }
  });
  // Handle Clear Profile
  const btnClearProfile = document.getElementById('btn-clear-profile');
  if (btnClearProfile) {
      btnClearProfile.addEventListener('click', async () => {
          if (!confirm("Are you sure you want to clear all manual measurements and scan history? This action cannot be undone.")) {
              return;
          }
          
          try {
              if (!window.supabase) return;
              const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
              const { data: { session } } = await supabase.auth.getSession();
              
              // Reset local storage
              localStorage.removeItem('styla_twin_chest');
              localStorage.removeItem('styla_twin_waist');
              localStorage.removeItem('styla_twin_belly');
              localStorage.removeItem('styla_twin_hips');
              localStorage.removeItem('styla_twin_height');
              localStorage.removeItem('styla_twin_inseam');
              localStorage.removeItem('styla_twin_api_scans');
              localStorage.removeItem('styla_twin_measurement_overrides');
              
              // Reset inputs in UI
              document.getElementById('val-chest').value = '';
              document.getElementById('val-waist').value = '';
              document.getElementById('val-belly').value = '';
              document.getElementById('val-hips').value = '';
              document.getElementById('val-height-ft').value = '';
              document.getElementById('val-height-in').value = '';
              document.getElementById('val-inseam').value = '';
              
              const badge = document.getElementById('active-scan-badge');
              if (badge) badge.style.display = 'none';
              
              if (session) {
                  const { error } = await supabase
                    .from('profiles')
                    .update({
                      chest: null,
                      waist: null,
                      belly: null,
                      hips: null,
                      height: null,
                      inseam: null,
                      api_scans: [],
                      measurement_overrides: {}
                    })
                    .eq('id', session.user.id);
                  
                  if (error) throw error;
                  
                  // Refresh UI
                  const profile = await getOrCreateProfile(supabase, session.user);
                  renderScanHistory(profile);
              }
              
              alert("All dimensions and scans successfully cleared.");
              
          } catch (err) {
              console.error("Failed to clear profile dimensions:", err);
              alert("Error: " + err.message);
          }
      });
  }

  // Handle Delete Profile & Account
  const btnDeleteProfile = document.getElementById('btn-delete-profile');
  if (btnDeleteProfile) {
      btnDeleteProfile.addEventListener('click', async () => {
          if (!confirm("Are you sure you want to delete your profile permanently? This will delete all measurements, scans, and your account.")) {
              return;
          }
          
          try {
              if (!window.supabase) return;
              const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
              const { data: { session } } = await supabase.auth.getSession();
              
              if (session) {
                  const { error: dbError } = await supabase
                    .from('profiles')
                    .delete()
                    .eq('id', session.user.id);
                    
                  if (dbError) throw dbError;
                  await supabase.auth.signOut();
              }
              
              // Clear everything locally
              localStorage.removeItem('styla_twin_chest');
              localStorage.removeItem('styla_twin_waist');
              localStorage.removeItem('styla_twin_belly');
              localStorage.removeItem('styla_twin_hips');
              localStorage.removeItem('styla_twin_height');
              localStorage.removeItem('styla_twin_inseam');
              localStorage.removeItem('styla_twin_api_scans');
              localStorage.removeItem('styla_twin_measurement_overrides');
              
              // Clear inputs
              document.getElementById('val-chest').value = '';
              document.getElementById('val-waist').value = '';
              document.getElementById('val-belly').value = '';
              document.getElementById('val-hips').value = '';
              document.getElementById('val-height-ft').value = '';
              document.getElementById('val-height-in').value = '';
              document.getElementById('val-inseam').value = '';
              
              const badge = document.getElementById('active-scan-badge');
              if (badge) badge.style.display = 'none';
              
              document.getElementById('btn-show-login').style.display = 'block';
              document.getElementById('logged-in-status').style.display = 'none';
              
              const manageBox = document.getElementById('manage-profile-box');
              if (manageBox) manageBox.style.display = 'none';
              
              alert("Your profile and account have been deleted.");
              
          } catch (err) {
              console.error("Failed to delete profile:", err);
              alert("Error: " + err.message);
          }
      });
  }

  // 3D Body Scanning Widget UI Handlers - Cleaned up for direct MTM integration

  // Step 3 Legacy Panel toggle
  const step3Container = document.getElementById('step-3-container');
  const step3Header = document.getElementById('step-3-toggle-header');
  const step3Body = document.getElementById('step-3-expandable-body');
  const step3Arrow = document.getElementById('step-3-toggle-arrow');

  if (step3Header && step3Body && step3Arrow && step3Container) {
      step3Header.addEventListener('click', () => {
          if (step3Body.style.display === 'none') {
              step3Body.style.display = 'block';
              step3Arrow.textContent = '▲';
              step3Arrow.style.color = '#ff75a0';
              step3Container.style.opacity = '1';
              step3Container.style.borderStyle = 'solid';
          } else {
              step3Body.style.display = 'none';
              step3Arrow.textContent = '▼';
              step3Arrow.style.color = 'var(--text-muted)';
              step3Container.style.opacity = '0.8';
              step3Container.style.borderStyle = 'dashed';
          }
      });
  }

  //
  const btnTabScan = document.getElementById('btn-tab-scan');
  const btnTabManual = document.getElementById('btn-tab-manual');
  const scanWorkspace = document.getElementById('scan-panel-workspace');
  const manualWorkspace = document.getElementById('manual-panel-workspace');

  if (btnTabScan && btnTabManual && scanWorkspace && manualWorkspace) {
      btnTabScan.addEventListener('click', () => {
          btnTabScan.classList.add('active');
          btnTabManual.classList.remove('active');
          scanWorkspace.style.display = 'block';
          manualWorkspace.style.display = 'none';
      });

      btnTabManual.addEventListener('click', () => {
          btnTabManual.classList.add('active');
          btnTabScan.classList.remove('active');
          manualWorkspace.style.display = 'block';
          scanWorkspace.style.display = 'none';
      });
  }


  // Handle scan email input validation
  const scanEmailInput = document.getElementById('scan-email');
  const widgetContainer = document.querySelector('.saia-widget-container');
  const scanEmailError = document.getElementById('scan-email-error');

  function validateScanEmail() {
      if (!scanEmailInput || !widgetContainer) return;
      
      // If user is already logged in, bypass validation
      if (window.supabase) {
          const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          supabase.auth.getSession().then(({ data: { session } }) => {
              if (session) {
                  const container = document.getElementById('scan-email-container');
                  if (container) container.style.display = 'none';
                  widgetContainer.style.pointerEvents = 'auto';
                  widgetContainer.style.opacity = '1';
                  return;
              }
          });
      }

      const email = scanEmailInput.value.trim();
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      
      if (emailRegex.test(email)) {
          if (scanEmailError) scanEmailError.style.display = 'none';
          widgetContainer.style.pointerEvents = 'auto';
          widgetContainer.style.opacity = '1';
          
          if (window.MTM_WIDGET_OPTIONS) {
              window.MTM_WIDGET_OPTIONS.defaultValues = window.MTM_WIDGET_OPTIONS.defaultValues || {};
              window.MTM_WIDGET_OPTIONS.defaultValues.email = email;
          }
      } else {
          widgetContainer.style.pointerEvents = 'none';
          widgetContainer.style.opacity = '0.4';
          if (email && scanEmailError) {
              scanEmailError.textContent = "Please enter a valid email address.";
              scanEmailError.style.display = 'block';
          } else if (scanEmailError) {
              scanEmailError.style.display = 'none';
          }
      }
  }

  if (scanEmailInput) {
      scanEmailInput.addEventListener('input', validateScanEmail);
      scanEmailInput.addEventListener('blur', validateScanEmail);
      // Run once on load
      validateScanEmail();
  }

