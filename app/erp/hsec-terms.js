// Billing schedule: paste a contract's payment terms as written ("25% advance; 25% on delivery at site; ...") and the
// milestones are made from them (hassan, 2026-10-29). Each part becomes one row with its %; the amount follows the
// project's contract value. Planned dates are still entered by hand, then Save schedule as usual.
(function () {
  /* global special, bsEdit, render, toast, esc, $, V, Store, fmt */
  function parse(text) {
    return String(text || "").split(/[;\n]+/).map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      var m = s.match(/^(\d+(?:\.\d+)?)\s*%\s*(.*)$/) || s.match(/^(.*?)\s*[-:@]?\s*(\d+(?:\.\d+)?)\s*%$/);
      if (!m) return null;
      var pct = /^\d/.test(m[1]) ? +m[1] : +m[2], name = (/^\d/.test(m[1]) ? m[2] : m[1]).replace(/^[\s,.-]+|[\s,.]+$/g, "");
      name = name || "Milestone";
      return { m: name.charAt(0).toUpperCase() + name.slice(1), pct: pct };
    });
  }
  function box() {
    return '<div class="calc" id="fsTerms" style="margin:10px 0"><label for="fsTermsTx" style="display:block;font-weight:600;margin-bottom:4px">Paste the payment terms from the contract</label>' +
      '<textarea id="fsTermsTx" rows="2" style="width:100%;box-sizing:border-box" placeholder="e.g. 25% advance; 25% on delivery at site; 25% during installation; 25% after handover"></textarea>' +
      '<div class="actions" style="margin-top:6px"><button class="btn" type="button" id="fsTermsGo">Make milestones from these terms</button>' +
      '<span class="muted">One milestone per part, split at ";" or a new line. Then enter each planned date and press Save schedule.</span></div><p class="err" id="fsTermsErr"></p></div>';
  }
  function hook() {
    if (typeof special !== "function" || typeof bsEdit !== "function") return false;
    var old = special;
    special = function (tab) { // eslint-disable-line no-global-assign
      var h = old(tab);
      if (tab !== "bsched" || typeof h !== "string") return h;
      var at = h.indexOf('<div class="tw"><table class="bstab"');
      return at < 0 ? h : h.slice(0, at) + box() + h.slice(at);
    };
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("#fsTermsGo");
      if (!t) return;
      var er = $("#fsTermsErr"), parts = parse(($("#fsTermsTx") || {}).value);
      if (!parts.length) { er.textContent = "Paste the terms first, for example: 25% advance; 25% on delivery at site."; return; }
      if (parts.some(function (p) { return !p; })) { er.textContent = "Every part needs a %, for example \"10% on T&C\". Check the text and try again."; return; }
      var E = bsEdit(), have = E.rows.reduce(function (s, r) { return s + (+r.pct || 0); }, 0), add = parts.reduce(function (s, p) { return s + p.pct; }, 0);
      if (have + add > 100.001) { er.textContent = "These terms add " + add + "% to the " + have + "% already scheduled, more than 100%. Remove the old rows first."; return; }
      parts.forEach(function (p) { E.rows.push({ id: "ms" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), m: p.m, pct: p.pct, amt: "", plan: "" }); });
      toast(parts.length + " milestones made (" + add + "% of the contract). Enter each planned date, then Save schedule.");
      render();
    });
    if (/bsched/.test(location.hash) && typeof render === "function") render();
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
