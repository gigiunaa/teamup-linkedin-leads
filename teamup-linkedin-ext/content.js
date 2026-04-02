(function () {
  "use strict";

  var PANEL_ID = "teamup-lead-panel";
  var BTN_ID = "teamup-lead-btn";

  function extractProfileData() {
    var data = {
      firstName: "",
      lastName: "",
      country: "",
      headline: "",
      company: "",
      profileUrl: window.location.href.split("?")[0]
    };

    // Primary: Topcard section (new LinkedIn layout)
    var topcard = document.querySelector('[componentkey*="Topcard"]');
    if (topcard) {
      // Name: h2 inside Topcard
      var nameH2 = topcard.querySelector("h2");
      if (nameH2) {
        var parts = nameH2.textContent.trim().split(/\s+/);
        data.firstName = parts[0] || "";
        data.lastName = parts.slice(1).join(" ") || "";
      }

      // After the name h2, <p> tags contain: headline, company line, location
      var pTags = topcard.querySelectorAll("p");
      var infoTexts = [];
      for (var i = 0; i < pTags.length; i++) {
        var txt = pTags[i].textContent.trim();
        if (txt && txt.length > 1 && txt.length < 120 &&
            !/^\d+\s*(follower|connection)/i.test(txt) &&
            !/followed by|others you know|mutual/i.test(txt) &&
            txt !== "·" && !/^· \d/.test(txt)) {
          infoTexts.push(txt);
        }
      }
      // infoTexts order: [name, "· 1st/2nd", headline, "company · school", location, ...]
      // Find headline: first text that isn't the name and isn't a degree indicator
      for (var j = 0; j < infoTexts.length; j++) {
        var t = infoTexts[j];
        if (t === data.firstName + " " + data.lastName) continue;
        if (/^·\s*(1st|2nd|3rd)/i.test(t)) continue;
        if (!data.headline) {
          data.headline = t;
        } else if (!data.company && /·/.test(t)) {
          // "Gegidze · Free University of Tbilisi" → take first part as company
          data.company = t.split("·")[0].trim();
        } else if (!data.country && /,/.test(t) && t.length < 60) {
          data.country = t;
          break;
        }
      }
    }

    // Fallback: old LinkedIn layout selectors
    if (!data.firstName) {
      var nameEl =
        document.querySelector("h1.text-heading-xlarge") ||
        document.querySelector("h1.inline.t-24") ||
        document.querySelector(".pv-text-details--left-panel h1") ||
        document.querySelector(".profile-topcard-person-entity__name");
      if (nameEl) {
        var parts2 = nameEl.textContent.trim().split(/\s+/);
        data.firstName = parts2[0] || "";
        data.lastName = parts2.slice(1).join(" ") || "";
      }
    }

    if (!data.headline) {
      var headEl =
        document.querySelector(".text-body-medium.break-words") ||
        document.querySelector(".pv-text-details--left-panel .text-body-medium");
      if (headEl) data.headline = headEl.textContent.trim();
    }

    if (!data.company) {
      var companyEl =
        document.querySelector(".pv-text-details--right-panel .inline-show-more-text") ||
        document.querySelector('button[aria-label*="Current company"] span');
      if (companyEl) data.company = companyEl.textContent.trim();
    }

    if (!data.country) {
      var locEl =
        document.querySelector(".pv-text-details--left-panel .text-body-small:not(.hoverable-link-text)") ||
        document.querySelector(".profile-topcard__location-data");
      if (locEl) {
        var locText = locEl.textContent.trim();
        if (locText && !/followed by|others you know/i.test(locText) && locText.length < 60) {
          data.country = locText;
        }
      }
    }

    // Fallback: extract from Experience section
    if (!data.headline || !data.company) {
      var expData = extractFromExperience();
      if (!data.headline && expData.title) data.headline = expData.title;
      if (!data.company && expData.company) data.company = expData.company;
    }

    return data;
  }

  function extractFromExperience() {
    var result = { title: "", company: "" };

    // Find experience section by componentkey or h2 text
    var expSection = document.querySelector('[componentkey*="ExperienceTopLevelSection"]');
    if (!expSection) {
      var h2s = document.querySelectorAll("h2");
      for (var i = 0; i < h2s.length; i++) {
        if (/^\s*Experience\s*$/i.test(h2s[i].textContent)) {
          expSection = h2s[i].closest("section") || h2s[i].parentElement;
          break;
        }
      }
    }
    if (!expSection) return result;

    // Company: from first logo alt attribute ("Gegidze logo" → "Gegidze")
    var logoImg = expSection.querySelector("img[alt$=' logo']");
    if (logoImg) {
      result.company = (logoImg.getAttribute("alt") || "").replace(/\s*logo\s*$/i, "").trim();
    }

    // Title: first <li> → first <p> (grouped roles like "Chief Marketing Officer")
    var firstLi = expSection.querySelector("ul li");
    if (firstLi) {
      var firstP = firstLi.querySelector("p");
      if (firstP) result.title = firstP.textContent.trim();
    }

    // Fallback for single-role entries (no <ul>): first <p> that isn't company/duration
    if (!result.title) {
      var pTags = expSection.querySelectorAll("p");
      for (var j = 0; j < pTags.length; j++) {
        var txt = pTags[j].textContent.trim();
        if (txt && txt.length > 2 && txt.length < 80 &&
            txt !== result.company && !/experience/i.test(txt) &&
            !/full.time|part.time|contract|freelance|remote|hybrid|on.site/i.test(txt) &&
            !/\d+\s*(yr|mo|year|month)/i.test(txt)) {
          result.title = txt;
          break;
        }
      }
    }

    return result;
  }

  function createButton() {
    if (document.getElementById(BTN_ID)) return;
    var btn = document.createElement("div");
    btn.id = BTN_ID;
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
      '<line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>' +
      "<span>TeamUp</span>";
    btn.addEventListener("click", togglePanel);
    document.body.appendChild(btn);
  }

  function togglePanel() {
    var existing = document.getElementById(PANEL_ID);
    if (existing) { existing.remove(); return; }
    createPanel();
  }

  function createPanel() {
    var p = extractProfileData();
    var panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML =
      '<div class="tu-header"><span class="tu-title">TeamUp &rarr; Zoho CRM</span><span class="tu-close" id="tu-close">&times;</span></div>' +
      '<div class="tu-body">' +
      '<div class="tu-sf-badge tu-sf-warn" id="tu-clip-msg">Copy email in Salesforge, it auto-fills here</div>' +
      '<div class="tu-row"><div class="tu-field"><label>First name</label><input type="text" id="tu-fname" value="' + esc(p.firstName) + '"/></div>' +
      '<div class="tu-field"><label>Last name</label><input type="text" id="tu-lname" value="' + esc(p.lastName) + '"/></div></div>' +
      '<div class="tu-field"><label>Email</label><input type="email" id="tu-email" placeholder="name@company.com"/></div>' +
      '<div class="tu-field"><label>Phone</label><input type="tel" id="tu-phone" placeholder="+1..."/></div>' +
      '<div class="tu-field"><label>Headline</label><input type="text" id="tu-head" value="' + esc(p.headline) + '"/></div>' +
      '<div class="tu-row"><div class="tu-field"><label>Company</label><input type="text" id="tu-comp" value="' + esc(p.company) + '"/></div>' +
      '<div class="tu-field"><label>Country</label><input type="text" id="tu-country" value="' + esc(p.country) + '"/></div></div>' +
      '<div class="tu-field"><label>LinkedIn URL</label><input type="text" id="tu-url" value="' + esc(p.profileUrl) + '" readonly/></div>' +
      '<div id="tu-status" class="tu-status"></div>' +
      '<button id="tu-submit" class="tu-btn">Send to Zoho CRM</button></div>';

    document.body.appendChild(panel);
    document.getElementById("tu-close").addEventListener("click", function () { panel.remove(); });
    document.getElementById("tu-submit").addEventListener("click", handleSubmit);
    tryClipboard();
  }

  function tryClipboard() {
    chrome.storage.local.get(["tuEmail", "tuPhone"], function (stored) {
      var filled = [];
      var emailEl = document.getElementById("tu-email");
      var phoneEl = document.getElementById("tu-phone");

      if (stored.tuEmail && emailEl && !emailEl.value) {
        emailEl.value = stored.tuEmail;
        filled.push("email");
      }
      if (stored.tuPhone && phoneEl && !phoneEl.value) {
        phoneEl.value = stored.tuPhone;
        filled.push("phone");
      }

      if (filled.length) {
        var msg = document.getElementById("tu-clip-msg");
        if (msg) { msg.textContent = filled.join(" & ") + " auto-filled from Salesforge"; msg.className = "tu-sf-badge"; }
      }

      // Also try current clipboard for anything not yet filled
      if ((!stored.tuEmail || emailEl.value) && (!stored.tuPhone || phoneEl.value)) return;
      if (!navigator.clipboard || !navigator.clipboard.readText) return;
      navigator.clipboard.readText().then(function (text) {
        text = (text || "").trim();
        if (text && text.indexOf("@") !== -1 && text.indexOf(".") !== -1 && text.length < 100) {
          if (emailEl && !emailEl.value) { emailEl.value = text; }
        } else if (text && /^\+?\d[\d\s\-()]{6,}$/.test(text) && text.length < 30) {
          if (phoneEl && !phoneEl.value) { phoneEl.value = text; }
        }
      }).catch(function () {});
    });
  }

  var _submitting = false;

  function handleSubmit() {
    if (_submitting) return;
    var btn = document.getElementById("tu-submit");
    var status = document.getElementById("tu-status");
    var firstName = document.getElementById("tu-fname").value.trim();
    var lastName = document.getElementById("tu-lname").value.trim();
    var email = document.getElementById("tu-email").value.trim();
    var phone = document.getElementById("tu-phone").value.trim();
    var country = document.getElementById("tu-country").value.trim();
    var profileUrl = document.getElementById("tu-url").value;
    var headline = document.getElementById("tu-head").value;
    var company = document.getElementById("tu-comp").value;

    if (!firstName || !lastName) { showStatus(status, "First and last name required", "error"); return; }
    if (!email || email.indexOf("@") === -1) { showStatus(status, "Valid email required", "error"); return; }

    _submitting = true;
    btn.disabled = true;
    btn.textContent = "Sending...";
    showStatus(status, "Sending to Zoho CRM...", "loading");

    chrome.runtime.sendMessage({
      action: "sendLead",
      payload: {
        firstName: firstName, lastName: lastName, email: email,
        phone: phone || null, country: country || null, company: company || null,
        linkedinUrl: profileUrl, headline: headline || null,
        tag: "Inbound", leadSource: "Sales Team", capturedAt: new Date().toISOString()
      }
    }, function (resp) {
      if (resp && resp.success) {
        showStatus(status, "✅ " + firstName + " " + lastName + " — sent to Zoho CRM!", "success");
        btn.textContent = "Done!";
        btn.style.background = "#0f6e56";
        chrome.storage.local.remove(["tuEmail", "tuPhone"]);
      } else {
        showStatus(status, "Error: " + ((resp && resp.error) || "Unknown"), "error");
        _submitting = false;
        btn.disabled = false;
        btn.textContent = "Retry";
      }
    });
  }

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function showStatus(el, msg, type) { el.textContent = msg; el.className = "tu-status tu-status--" + type; }

  function init() { setTimeout(createButton, 1500); }

  var lastUrl = location.href;
  var navTimer;
  new MutationObserver(function () {
    if (location.href !== lastUrl) {
      clearTimeout(navTimer);
      navTimer = setTimeout(function () {
        lastUrl = location.href;
        _submitting = false;
        var a = document.getElementById(BTN_ID); if (a) a.remove();
        var b = document.getElementById(PANEL_ID); if (b) b.remove();
        if (location.href.indexOf("/in/") !== -1 || location.href.indexOf("/sales/lead/") !== -1) init();
      }, 300);
    }
  }).observe(document.body, { childList: true, subtree: true });

  init();
})();
