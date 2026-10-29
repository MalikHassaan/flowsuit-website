// Voucher numbers open the voucher, everywhere in HSEC (hassan, 2026-10-29: "voucher should be clickable, once I click it should
// show the voucher" and "this should be on all"). Any text on screen that is the number of a voucher in the books
// (SINV-HSEC-0001, JV-HSEC-0016, BPV-ENT1-0003 ...), in lists, forms, panels, reports or Home, becomes a link; a click (or Enter)
// opens the printable voucher (jvSheet), the same sheet shown after posting. Text inside inputs, buttons, existing links and
// the voucher sheet itself is left alone.
(function () {
  /* global Store, jvSheet, sheetOpen, openForm */
  var RE = /\b[A-Z]{2,6}-[A-Za-z0-9]+-\d{3,}\b/g, SKIP = "a,button,input,select,textarea,option,script,style,#printLayer,.fs-vlink,[contenteditable]";
  var refs = null, refsAt = 0;
  function refMap() {
    var now = Date.now();
    if (!refs || now - refsAt > 3000) { refs = new Map(); Store.data.journals.forEach(function (j) { if (j.ref) refs.set(j.ref, j); }); refsAt = now; }
    return refs;
  }
  function mark() {
    if (typeof Store === "undefined" || !Store.data || !Store.data.journals || !Store.data.journals.length) return;
    var M = refMap(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (t) { return RE.test(t.nodeValue) && (RE.lastIndex = 0, true) && t.parentElement && !t.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } }), list = [];
    RE.lastIndex = 0;
    while (w.nextNode()) list.push(w.currentNode);
    list.forEach(function (t) {
      var s = t.nodeValue, out = [], last = 0, m, hit = false;
      RE.lastIndex = 0;
      while ((m = RE.exec(s))) {
        if (!M.has(m[0])) continue;
        hit = true; out.push(document.createTextNode(s.slice(last, m.index)));
        var a = document.createElement("span"); a.className = "fs-vlink"; a.textContent = m[0];
        a.setAttribute("data-vref", m[0]); a.setAttribute("role", "link"); a.setAttribute("tabindex", "0"); a.title = "Open voucher " + m[0];
        out.push(a); last = m.index + m[0].length;
      }
      if (!hit) return;
      out.push(document.createTextNode(s.slice(last)));
      var f = document.createDocumentFragment(); out.forEach(function (x) { if (x.nodeType !== 3 || x.nodeValue) f.appendChild(x); });
      t.parentNode.replaceChild(f, t);
    });
  }
  function open(ref) {
    var j = refMap().get(ref); if (!j) return;
    if (typeof jvSheet === "function" && typeof sheetOpen === "function") sheetOpen(jvSheet(j)); else openForm("journals", j.id);
  }
  function go(e) {
    var s = e.target.closest && e.target.closest(".fs-vlink[data-vref]"); if (!s) return;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); e.stopImmediatePropagation(); open(s.getAttribute("data-vref"));
  }
  document.addEventListener("click", go, true);
  document.addEventListener("keydown", go, true);
  var css = document.createElement("style");
  css.textContent = ".fs-vlink{color:var(--acc,#1F6FB8);text-decoration:underline;cursor:pointer}.fs-vlink:hover{text-decoration-thickness:2px}@media print{.fs-vlink{color:inherit;text-decoration:none}}";
  document.head.appendChild(css);
  var queued = false;
  function soon() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; try { mark(); } catch (e) { console.warn(e); } }); }
  function start() { soon(); new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, characterData: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
