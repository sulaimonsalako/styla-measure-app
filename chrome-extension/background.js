chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SYNC_MEASUREMENTS") {
    chrome.storage.local.set({ 
      measurements: message.measurements,
      apiHost: message.origin
    }, () => {
      console.log("Styla twin measurements and host synced:", message.measurements, message.origin);
    });
    sendResponse({ status: "success" });
  }
  return true;
});
