chrome.alarms.create("keepAlive", { periodInMinutes: 14 });

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "keepAlive") {
    chrome.storage.sync.get(["apiUrl"], function (stored) {
      if (!stored.apiUrl) return;
      var healthUrl = stored.apiUrl.replace(/\/api\/lead\/?$/, "/health");
      fetch(healthUrl).catch(function () {});
    });
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "sendLead") {
    chrome.storage.sync.get(["apiUrl"], function (stored) {
      var apiUrl = stored.apiUrl;
      if (!apiUrl) {
        sendResponse({ success: false, error: "API URL not configured. Go to extension options." });
        return;
      }
      fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message.payload)
      })
        .then(function (resp) { return resp.json(); })
        .then(function (data) {
          if (data.success) {
            sendResponse({ success: true, zohoId: data.zohoId, message: data.message });
          } else {
            sendResponse({ success: false, error: data.error || "Server error" });
          }
        })
        .catch(function (err) {
          sendResponse({ success: false, error: err.message });
        });
    });
    return true;
  }
});
