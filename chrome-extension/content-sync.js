function syncMeasurements() {
  // Safe guard check for chrome runtime presence
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

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

  const measurements = {
    chest: localStorage.getItem('styla_twin_chest'),
    waist: localStorage.getItem('styla_twin_waist'),
    belly: localStorage.getItem('styla_twin_belly'),
    hips: localStorage.getItem('styla_twin_hips'),
    height: localStorage.getItem('styla_twin_height'),
    inseam: localStorage.getItem('styla_twin_inseam'),
    api_scans,
    measurement_overrides
  };

  if (measurements.chest || measurements.waist || measurements.hips) {
    try {
      // Accessing getManifest will throw a catchable JS exception if the context was invalidated
      chrome.runtime.getManifest();

      chrome.runtime.sendMessage({
        type: "SYNC_MEASUREMENTS",
        measurements,
        origin: window.location.origin
      }, (response) => {
        // Read runtime.lastError to prevent Chrome from logging it as an uncaught exception
        const err = chrome.runtime.lastError;
      });
    } catch (err) {
      // Suppress extension reload errors
    }
  }
}

// Run immediately on page load
if (document.readyState === "complete" || document.readyState === "interactive") {
  syncMeasurements();
} else {
  document.addEventListener("DOMContentLoaded", syncMeasurements);
}

// Sync only when localStorage is actively changed (no polling)
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('styla_twin_')) {
    try {
      syncMeasurements();
    } catch (err) {}
  }
});
