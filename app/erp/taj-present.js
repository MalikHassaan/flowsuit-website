// TAJ dashboard, presentation mode: let the charts use the whole slide.
// The dashboard scales a tall report down to fit the screen, but a short report stays at its normal size and
// leaves empty space below it, and a report laid out in columns leaves a gap under its shorter column. Here
// every chart card stretches to the height of its row (CSS in taj_inject), and the charts take the spare space.
(function () {
  function grow() {
    var m = document.querySelector(".main"), sec = document.querySelector("#pages .page");
    if (!m || !sec) return;
    var charts = Array.prototype.slice.call(sec.querySelectorAll(".chart"));
    charts.forEach(function (c) { c.style.minHeight = ""; });
    if (!document.body.classList.contains("present") || document.body.classList.contains("preszoom") || !charts.length) return;
    var z = parseFloat((m.style.transform.match(/scale\(([\d.]+)\)/) || [0, 1])[1]) || 1;
    var height = function () { return (sec.getBoundingClientRect().bottom - m.getBoundingClientRect().top) / z; };
    var h0 = height(), room = (window.innerHeight - 86) / z;   // the same room the dashboard leaves for its slide bar
    charts = charts.filter(function (c) { return c.offsetParent; });
    if (!sec.classList.contains("pcols")) {
      // One column of rows: share the space left under the report between the rows that have charts.
      var rows = {};
      charts.forEach(function (c) {
        var k = Math.round(c.getBoundingClientRect().top / 8);
        (rows[k] = rows[k] || []).push(c);
      });
      var keys = Object.keys(rows), each = Math.floor((room - h0) / keys.length);
      var was = charts.map(function (c) { return c.offsetHeight; });   // read them all before any grows
      if (each > 8) charts.forEach(function (c, i) { c.style.minHeight = (was[i] + each) + "px"; });
      return;
    }
    // Newspaper columns: each chart grows as far as it can without making the report taller, which fills the
    // gap under a short column (and the space under the report, if there is some).
    var target = Math.max(h0, room);
    charts.forEach(function (c) {
      var base = c.offsetHeight, lo = 0, hi = Math.round(target);
      while (hi - lo > 6) {
        var mid = Math.round((lo + hi) / 2);
        c.style.minHeight = (base + mid) + "px";
        if (height() <= target + 1) lo = mid; else hi = mid;
      }
      c.style.minHeight = lo > 8 ? (base + lo) + "px" : "";
    });
  }
  var timer;
  function later() { clearTimeout(timer); timer = setTimeout(grow, 60); }
  addEventListener("DOMContentLoaded", function () {
    var m = document.querySelector(".main");
    if (!m || !window.MutationObserver) return;
    // The dashboard fits each slide by setting the size and scale on .main.
    new MutationObserver(later).observe(m, { attributes: true, attributeFilter: ["style"] });
    new MutationObserver(later).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    var pages = document.getElementById("pages");
    if (pages) new MutationObserver(later).observe(pages, { childList: true });
  });
})();
