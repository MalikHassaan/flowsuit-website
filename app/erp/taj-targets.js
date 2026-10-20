// TAJ dashboard, Collection targets: save a target as soon as it is typed.
// The dashboard only saves when "Save targets" (at the top of the page) is pressed, so targets typed in the
// table looked as if they did nothing. Here leaving a box, or pressing Enter, saves straight away, and the
// cursor goes back to the box the person moved on to once the page redraws with the new figures.
(function () {
  var timer, lastTk = null;
  addEventListener("DOMContentLoaded", function () {
    var pages = document.getElementById("pages");
    if (!pages) return;
    pages.addEventListener("change", function (e) {
      if (!e.target.classList || !e.target.classList.contains("tgin")) return;
      clearTimeout(timer);
      timer = setTimeout(function () { var b = document.getElementById("tgSave"); if (b) b.click(); }, 300);
    });
    pages.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.classList && e.target.classList.contains("tgin")) e.target.blur();
    });
    document.addEventListener("focusin", function (e) {
      lastTk = e.target.classList && e.target.classList.contains("tgin") ? e.target.dataset.tk : null;
    });
    if (!window.MutationObserver) return;
    new MutationObserver(function () {
      if (!lastTk || (document.activeElement && document.activeElement !== document.body)) return;
      var i = pages.querySelector('.tgin[data-tk="' + lastTk + '"]');
      if (i) { i.focus(); i.select(); }
    }).observe(pages, { childList: true, subtree: true });
  });
})();
