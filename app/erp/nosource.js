// For everyone but admins: the right-click menu and the view-source / developer-tools / save-page shortcuts are
// switched off (hassan, 2026-10-30). This only slows a curious user down; the browser still holds the page, so
// what a person must not see is kept off the page by the server, never hidden here.
(function () {
  function stop(e) { e.preventDefault(); e.stopImmediatePropagation(); return false; }
  window.addEventListener("contextmenu", function (e) {
    // copy and paste in typing boxes still work
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable=true]")) return;
    stop(e);
  }, true);
  window.addEventListener("keydown", function (e) {
    var k = String(e.key || "").toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (k === "f12" || (mod && (k === "u" || k === "s")) || (mod && e.shiftKey && (k === "i" || k === "j" || k === "c")) || (e.metaKey && e.altKey && (k === "i" || k === "j" || k === "u"))) stop(e);
  }, true);
})();
