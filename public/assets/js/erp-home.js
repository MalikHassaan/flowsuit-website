// ERP dashboard: figures count up from zero, the clock ticks, and the tiles pulse gently when the page is open.
(function () {
  document.querySelectorAll("[data-count]").forEach(function (el, k) {
    var to = parseInt(el.getAttribute("data-count"), 10) || 0, t0 = null, dur = 1200 + k * 120;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(step);
    }
    setTimeout(function () { requestAnimationFrame(step); }, 250);
  });
  var clock = document.querySelector("[data-clock]");
  if (clock) setInterval(function () {
    clock.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }).toLowerCase();
  }, 1000);
})();
