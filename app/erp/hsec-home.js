// The company logo at the top left goes back to Home (hassan, 2026-10-30: "once we click on the left top monogram of
// the company we should return back to home screen"). The app redraws its top bar, so the click is caught on the page.
(function () {
  document.addEventListener("click", function (e) {
    var w = e.target.closest && e.target.closest("#topbar .waffle");
    if (!w) return;
    e.preventDefault();
    if (location.hash !== "#dashboard") location.hash = "#dashboard";
    else window.scrollTo(0, 0);
  });
  var css = document.createElement("style");
  css.textContent = "#topbar .waffle{cursor:pointer}";
  (document.head || document.documentElement).appendChild(css);
})();
