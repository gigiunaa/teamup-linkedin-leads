document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("apiUrl");
  var btn = document.getElementById("saveBtn");
  var status = document.getElementById("status");

  chrome.storage.sync.get(["apiUrl"], function (data) {
    if (data.apiUrl) input.value = data.apiUrl;
  });

  btn.addEventListener("click", function () {
    var url = input.value.trim();
    if (!url || url.indexOf("https://") !== 0) {
      status.textContent = "Enter a valid HTTPS URL";
      status.style.color = "#993c1d";
      return;
    }
    chrome.storage.sync.set({ apiUrl: url }, function () {
      status.textContent = "Saved!";
      status.style.color = "#0f6e56";
    });
  });
});
