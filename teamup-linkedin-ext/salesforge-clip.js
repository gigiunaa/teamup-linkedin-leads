(function () {
  "use strict";

  document.addEventListener("copy", function () {
    setTimeout(function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) return;
      navigator.clipboard.readText().then(function (text) {
        text = (text || "").trim();
        if (!text) return;

        if (text.indexOf("@") !== -1 && text.indexOf(".") !== -1 && text.length < 100) {
          chrome.storage.local.set({ tuEmail: text });
        } else if (/^\+?\d[\d\s\-()]{6,}$/.test(text) && text.length < 30) {
          chrome.storage.local.set({ tuPhone: text });
        }
      }).catch(function () {});
    }, 100);
  });
})();
