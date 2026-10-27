// Easier voucher entry in HSEC (hassan, 2026-10-27: "make it user friendly"):
//   - the voucher form shows only what the chosen voucher type needs; the rest sits behind "More details";
//   - one box finds an account by code or name and fills a line, instead of two drop-downs;
//   - line columns nobody has used (reference, department) are folded away so Debit and Credit fit on screen;
//   - Status is a label, since the system sets it; and "Entity" reads "Company" everywhere.
(function () {
  /* global S, F, Store, accSorted, isPost, accLv, readLines, redrawLines, esc */
  var more = false, wide = false;

  function box(k) { var el = document.getElementById("f_" + k); return el && el.closest(".f"); }
  function val(k) { var el = document.getElementById("f_" + k); return el ? String(el.value || "") : ""; }

  function header() {
    var type = document.getElementById("f_vtype");
    if (!type) return;
    var t = type.value, bank = /^Bank /.test(t), cashBank = /^(Bank|Cash) (payment|receipt)/.test(t);
    var show = {
      ref: !!val("ref"),
      payee: cashBank || !!val("payee"),
      chequeNo: bank || !!val("chequeNo"),
      chequeDate: bank || !!val("chequeDate"),
      opening: val("opening") === "Yes"
    };
    var hid = 0;
    Object.keys(show).forEach(function (k) {
      var b = box(k);
      if (!b) return;
      var on = more || show[k];
      if (!on) hid++;
      if (b.hidden === on) b.hidden = !on;
    });
    var link = document.getElementById("fsMore"), anchor = box("narration");
    if (!link && anchor && hid) {
      link = document.createElement("div");
      link.className = "f w";
      link.innerHTML = '<button type="button" class="linkish" id="fsMore" style="background:none;border:0;padding:0;color:var(--accent,#0e7c66);font-weight:600;cursor:pointer">+ More details (voucher no., cheque, party, opening balance)</button>';
      anchor.after(link);
      link.firstChild.addEventListener("click", function () { more = true; link.remove(); header(); });
    } else if (link && !hid) {
      link.closest(".f").remove();
    }
    if (!type.dataset.fsUx) { type.dataset.fsUx = "1"; type.addEventListener("change", header); }
    // Status: set by the system (Draft, Pending approval, Posted); shown, not chosen.
    var st = document.getElementById("f_status");
    if (st && !st.disabled) { st.disabled = true; st.title = "Set by the system"; }
  }

  // The account finder above the lines: pick "1210-001 Meezan Bank" and it fills the first empty line (or a new one).
  function finder() {
    var head = document.querySelector("#linesBox .jhead");
    if (!head || head.querySelector(".fs-accq")) return;
    var accs = accSorted().filter(function (a) { return isPost(a) && accLv(a) === 4 && (!a.entity || a.entity === F.rec.entity); });
    var wrap = document.createElement("span");
    wrap.className = "fs-accq";
    wrap.innerHTML = '<input list="fsAccDl" placeholder="Find an account: type its code or name" aria-label="Find an account by code or name">'
      + '<datalist id="fsAccDl">' + accs.map(function (a) { return '<option value="' + esc(a.code + " " + a.name) + '"></option>'; }).join("") + '</datalist>'
      + '<button type="button" class="btn sm" data-fs-wide>' + (wide ? "Fewer columns" : "More columns") + '</button>';
    head.insertBefore(wrap, head.lastElementChild);
    var inp = wrap.querySelector("input");
    inp.addEventListener("change", function () {
      var a = accs.find(function (x) { return x.code + " " + x.name === inp.value; });
      if (!a) return;
      readLines();
      var i = F.lines.findIndex(function (l) { return !l.account && !l.main; });
      if (i < 0) { F.lines.push({ main: "", account: "", debit: "", credit: "" }); i = F.lines.length - 1; }
      F.lines[i].main = a.parent;
      F.lines[i].account = a.id;
      redrawLines("l_d" + i);
    });
    wrap.querySelector("[data-fs-wide]").addEventListener("click", function () { wide = !wide; readLines(); redrawLines(); });
  }

  // Reference and Department columns stay folded unless a line uses them or the person asks for them.
  function columns() {
    var t = document.querySelector("#linesBox .jtab");
    if (!t) return;
    var used = F && F.lines && F.lines.some(function (l) { return l.ref || l.dept; });
    t.classList.toggle("fs-lean", !wide && !used);
  }

  function tick() {
    var rec = null;
    try { rec = typeof F !== "undefined" && F && F.c === "journals" ? F.rec : null; } catch (x) {}
    if (!rec || !document.getElementById("frm")) return;
    header();
    if (document.getElementById("linesBox")) { finder(); columns(); }
  }

  function words() {
    Object.keys(S).forEach(function (c) {
      var s = S[c];
      (s.fields || []).forEach(function (f) { if (f.t === "entity" && f.l === "Entity") f.l = "Company"; });
      (s.cols || []).forEach(function (col) { if (col[1] === "Entity") col[1] = "Company"; });
    });
  }

  var css = document.createElement("style");
  css.textContent = ".fs-accq{display:inline-flex;gap:8px;align-items:center;margin-left:auto;margin-right:8px;flex-wrap:wrap}"
    + ".fs-accq input{min-width:240px;height:32px;padding:0 10px;border:1px solid var(--line,#d0d5dd);border-radius:8px;font:inherit}"
    + ".jhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}"
    + ".jtab.fs-lean col:nth-child(3),.jtab.fs-lean col:nth-child(5){visibility:collapse}"
    + "#f_status:disabled{background:var(--soft,#f2f4f7);color:inherit;opacity:1;cursor:default;appearance:none;-webkit-appearance:none}"
    + "@media (max-width:700px){.fs-accq,.fs-accq input{width:100%;min-width:0}}";
  document.head.appendChild(css);

  function start() {
    if (typeof S === "undefined" || !S.journals || typeof redrawLines !== "function") { setTimeout(start, 300); return; }
    words();
    new MutationObserver(function () { if (!document.getElementById("frm")) more = false; tick(); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
