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

    var nameEl =
      document.querySelector("h1.text-heading-xlarge") ||
      document.querySelector("h1.inline.t-24") ||
      document.querySelector(".pv-text-details--left-panel h1") ||
      document.querySelector('[data-anonymize="person-name"]') ||
      document.querySelector(".profile-topcard-person-entity__name");

    if (!nameEl) {
      var allH2 = document.querySelectorAll("h2");
      for (var i = 0; i < allH2.length; i++) {
        var t = allH2[i].textContent.trim();
        if (
          t &&
          !/notification|about|activity|service|experience|education|skill|more profile/i.test(t) &&
          t.split(/\s+/).length >= 2 &&
          t.split(/\s+/).length <= 5
        ) {
          nameEl = allH2[i];
          break;
        }
      }
    }

    if (nameEl) {
      var parts = nameEl.textContent.trim().split(/\s+/);
      data.firstName = parts[0] || "";
      data.lastName = parts.slice(1).join(" ") || "";
    }

    var locEl =
      document.querySelector(".pv-text-details--left-panel .text-body-small:not(.hoverable-link-text)") ||
      document.querySelector('span.text-body-small[aria-hidden="true"]') ||
      document.querySelector(".profile-topcard__location-data");

    if (locEl) {
      data.country = locEl.textContent.trim();
    }

    if (!data.country) {
      var allP = document.querySelectorAll("p");
      for (var j = 0; j < allP.length; j++) {
        var pt = allP[j].textContent.trim();
        if (/^[A-Z][\w\s\u00C0-\u024F-]+,\s*[A-Z][\w\s\u00C0-\u024F-]+$/.test(pt) && pt.length < 60) {
          data.country = pt;
          break;
        }
      }
    }

    var headEl =
      document.querySelector(".text-body-medium.break-words") ||
      document.querySelector(".pv-text-details--left-panel .text-body-medium");
    if (headEl) data.headline = headEl.textContent.trim();

    var companyEl =
      document.querySelector(".pv-text-details--right-panel .inline-show-more-text") ||
      document.querySelector('button[aria-label*="Current company"] span');
    if (companyEl) data.company = companyEl.textContent.trim();

    return data;
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
      '<div class="tu-row"><div class="tu-field"><label>Phone <span class="tu-hint">(optional)</span></label><input type="tel" id="tu-phone" placeholder="+1..."/></div>' +
      '<div class="tu-field"><label>Country</label><input type="text" id="tu-country" value="' + esc(p.country) + '"/></div></div>' +
      '<input type="hidden" id="tu-url" value="' + esc(p.profileUrl) + '"/>' +
      '<input type="hidden" id="tu-head" value="' + esc(p.headline) + '"/>' +
      '<input type="hidden" id="tu-comp" value="' + esc(p.company) + '"/>' +
      '<div id="tu-status" class="tu-status"></div>' +
      '<button id="tu-submit" class="tu-btn">Send to Zoho CRM</button></div>';

    document.body.appendChild(panel);
    document.getElementById("tu-close").addEventListener("click", function () { panel.remove(); });
    document.getElementById("tu-submit").addEventListener("click", handleSubmit);
    tryClipboard();
  }

  function tryClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    navigator.clipboard.readText().then(function (text) {
      text = (text || "").trim();
      if (text && text.indexOf("@") !== -1 && text.indexOf(".") !== -1 && text.length < 100) {
        var el = document.getElementById("tu-email");
        if (el && !el.value) {
          el.value = text;
          var msg = document.getElementById("tu-clip-msg");
          if (msg) { msg.textContent = "Email auto-filled from clipboard"; msg.className = "tu-sf-badge"; }
        }
      }
    }).catch(function () {});
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
        showStatus(status, "Lead created in Zoho CRM!", "success");
        btn.textContent = "Done!";
        setTimeout(function () { var x = document.getElementById(PANEL_ID); if (x) x.remove(); }, 1500);
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
