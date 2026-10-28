// TAJ dashboard: reports an admin has hidden (ERP setting taj_hidden, sent in FS_TAJ.hidden).
// taj_hide_hooks() wraps the dashboard's own lists in FS_MODS / FS_KEEP, so a hidden report is left out of the
// menu, All reports, the PDF and the slideshow for everyone. Nothing is deleted: an admin brings it back under
// TAJ Receivables > Manage > Reports in the menu. Admins also get a small x on each menu item to hide it.
(function () {
  var H = (window.FS_TAJ && FS_TAJ.hidden) || [];
  var gone = function (id) { return H.indexOf(id) >= 0; };
  window.FS_KEEP = function (list) {
    if (list.length && Array.isArray(list[0]) && !window.FS_ALLPAGES) window.FS_ALLPAGES = list;   // PAGES, kept whole for look-ups
    list = list.filter(function (x) { return !gone(Array.isArray(x) ? x[0] : x); });
    return list.length && !Array.isArray(list[0]) && window.FS_ORDER ? FS_ORDER(list) : list;   // PDF_ORDER follows the saved report order
  };
  window.FS_MODS = function (mods) {
    return mods.map(function (m) { return [m[0], m[1], m[2], m[3].filter(function (t) { return !gone(t); })]; })
      .filter(function (m) { return m[3].length; });
  };
  if (!window.FS_TAJ || !FS_TAJ.admin) return;

  var HIDEABLE = ["summary", "till", "history", "dormant", "overdue", "plan", "status", "property", "file", "collection", "trend", "pace",
    "targets", "exceptions", "heads", "desk", "lookup", "sales", "top", "agents", "vintage", "plotsize", "possession"];
  function addButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("#tabs .nav-i[data-tab]"), function (b) {
      if (HIDEABLE.indexOf(b.dataset.tab) < 0 || b.querySelector(".fs-hide")) return;
      var x = document.createElement("span");
      x.className = "fs-hide"; x.setAttribute("role", "button"); x.title = "Hide this report for everyone"; x.textContent = "×";
      b.appendChild(x);
    });
  }
  addEventListener("DOMContentLoaded", function () {
    var tabs = document.getElementById("tabs");
    if (!tabs) return;
    addButtons();
    if (window.MutationObserver) new MutationObserver(addButtons).observe(tabs, { childList: true, subtree: true });
    // Capture phase, so the dashboard does not also open the report.
    tabs.addEventListener("click", function (e) {
      var x = e.target.closest && e.target.closest(".fs-hide");
      if (!x) return;
      e.preventDefault(); e.stopPropagation();
      var b = x.closest("[data-tab]"), name = (b.querySelector(".lbl2") || b).textContent.trim();
      if (!confirm('Hide "' + name + '" for everyone?\n\nNo data is deleted. An admin can bring it back under TAJ Receivables > Manage > Reports in the menu.')) return;
      fetch(FS_TAJ.api + "/hide", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": FS_TAJ.csrf },
        body: JSON.stringify({ id: b.dataset.tab }) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); try { localStorage.setItem("taj-tab", "overview"); } catch (x) {} location.reload(); })
        .catch(function () { alert("Could not hide the report. Reload the page and try again."); });
    }, true);
  });
})();
