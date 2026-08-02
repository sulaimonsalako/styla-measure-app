chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SYNC_MEASUREMENTS") {
    const patch = { measurements: message.measurements, apiHost: message.origin };
    if (message.session) patch.session = message.session; // keep the signed-in session
    chrome.storage.local.set(patch, () => {});
    sendResponse({ status: "success" });
  }
  // Any page's Styla widget can ask the extension for the stored identity.
  if (message.type === "STYLA_GET_IDENTITY") {
    chrome.storage.local.get(["measurements", "session"], (data) => {
      sendResponse({ measurements: data.measurements || null, session: data.session || null });
    });
    return true; // async
  }
  return true;
});
