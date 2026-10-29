// Voucher numbers shown in lists open the voucher (hassan, 2026-10-29: "voucher should be clickable, once I click it should
// show the voucher"). Lists print the number as plain text (<span class="mono">SINV-HSEC-0001</span>); any such number that
// belongs to a voucher becomes a link, and a click opens the printable voucher (jvSheet), the same sheet shown after posting.
(function () {
  /* global Store, jvSheet, sheetOpen, openForm */
  var byRef = function (ref) { return ref ? Store.data.journals.find(function (j) { return j.ref === ref; }) : null; };
  function mark(root) {
    if (typeof Store === "undefined" || !Store.data || !Store.data.journals || !Store.data.journals.length) return;
    (root || document).querySelectorAll("#main span.mono:not([data-vref])").forEach(function (s) {
      var t = s.textContent.trim();
      if (!/^[A-Z]{2,6}-[A-Za-z0-9]+-\d+$/.test(t) || s.closest("a,button,#printLayer")) { s.setAttribute("data-vref", ""); return; }
      if (!byRef(t)) return;
      s.setAttribute("data-vref", t); s.classList.add("fs-vlink"); s.setAttribute("role", "link"); s.setAttribute("tabindex", "0"); s.title = "Open voucher " + t;
    });
  }
  function open(ref) {
    var j = byRef(ref); if (!j) return;
    if (typeof jvSheet === "function" && typeof sheetOpen === "function") sheetOpen(jvSheet(j)); else openForm("journals", j.id);
  }
  function go(e) {
    var s = e.target.closest && e.target.closest("[data-vref].fs-vlink"); if (!s) return;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); e.stopImmediatePropagation(); open(s.getAttribute("data-vref"));
  }
  document.addEventListener("click", go, true);
  document.addEventListener("keydown", go, true);
  var css = document.createElement("style");
  css.textContent = ".fs-vlink{color:var(--acc,#1F6FB8);text-decoration:underline;cursor:pointer}.fs-vlink:hover{text-decoration-thickness:2px}";
  document.head.appendChild(css);
  function start() {
    var m = document.getElementById("main"); if (!m) { setTimeout(start, 300); return; }
    mark(); new MutationObserver(function () { mark(); }).observe(m, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
