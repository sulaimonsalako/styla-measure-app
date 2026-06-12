function syncMeasurements() {
  // 1. Safe guard check for chrome runtime presence
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    if (window.stylaSyncInterval) {
      clearInterval(window.stylaSyncInterval);
    }
    return;
  }

  const measurements = {
    chest: localStorage.getItem('styla_twin_chest'),
    waist: localStorage.getItem('styla_twin_waist'),
    hips: localStorage.getItem('styla_twin_hips'),
    height: localStorage.getItem('styla_twin_height'),
    inseam: localStorage.getItem('styla_twin_inseam')
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
      // Extension was reloaded! Stop the polling immediately to prevent any console noise.
      if (window.stylaSyncInterval) {
        clearInterval(window.stylaSyncInterval);
      }
    }
  }
}

// Setup and track polling interval globally
if (window.stylaSyncInterval) {
  clearInterval(window.stylaSyncInterval);
}
window.stylaSyncInterval = setInterval(syncMeasurements, 3000);

// Run immediately or on load
if (document.readyState === "complete" || document.readyState === "interactive") {
  syncMeasurements();
} else {
  document.addEventListener("DOMContentLoaded", syncMeasurements);
}

// Watch localStorage updates
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('styla_twin_')) {
    syncMeasurements();
  }
});
