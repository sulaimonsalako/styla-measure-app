function syncMeasurements() {
  const measurements = {
    chest: localStorage.getItem('styla_twin_chest'),
    waist: localStorage.getItem('styla_twin_waist'),
    hips: localStorage.getItem('styla_twin_hips'),
    height: localStorage.getItem('styla_twin_height'),
    inseam: localStorage.getItem('styla_twin_inseam')
  };

  if (measurements.chest || measurements.waist || measurements.hips) {
    chrome.runtime.sendMessage({
      type: "SYNC_MEASUREMENTS",
      measurements,
      origin: window.location.origin
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Suppress extension message channel warnings when popup is closed
      }
    });
  }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  syncMeasurements();
} else {
  document.addEventListener("DOMContentLoaded", syncMeasurements);
}

window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('styla_twin_')) {
    syncMeasurements();
  }
});

setInterval(syncMeasurements, 3000);
