// Status filter on HSEC lists (hassan, 2026-11-11: "there should be status wise filter as well", on Journals).
// Every list with a Status column (Journals, Payment demands, bills, invoices and the rest) gets a "Status" picker beside
// Search: All statuses, or one status with its count. The rows, the record count and the totals row follow it.
// The choice is kept per list for the browser tab. It works on the drawn table, so it doesn't depend on how the app
// builds its lists.
(function () {
  var KEY = "fs-stf";
  var pick = (function () { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  var keep = function () { try { sessionStorage.setItem(KEY, JSON.stringify(pick)); } catch (e) { /* private window */ } };
  var txt = function (el) { return String((el && el.textContent) || "").replace(/\s+/g, " ").trim(); };
  var num = function (s) { s = String(s).replace(/,/g, "").trim(); var neg = /^\(.*\)$/.test(s); var v = parseFloat(neg ? s.slice(1, -1) : s); return isNaN(v) ? 0 : neg ? -v : v; };
  var fmt = function (v) { var r = Math.round(v), s = Math.abs(r).toLocaleString("en-US"); return r < 0 ? "(" + s + ")" : s; };

  function table() {
    var q = document.getElementById("q"), bar = q && q.closest(".bar"); if (!bar) return null;
    var tb = null, el = bar.nextElementSibling;
    while (el && !tb) { tb = el.matches("table") ? el : el.querySelector("table"); if (!tb || !tb.querySelector("tbody tr[data-edit]")) tb = null; el = el.nextElementSibling; }
    if (!tb) return null;
    var ths = [].slice.call(tb.querySelectorAll("thead th")), col = ths.findIndex(function (th) { return /^status$/i.test(txt(th)); });
    var c = tb.querySelector("tbody tr[data-edit]").getAttribute("data-edit");
    // rows of other offices, when one office is picked at the top (hsec-regions.js), are left out of everything here
    var out = window.FS_RG && window.FS_RG.out(c), rows = [].slice.call(tb.querySelectorAll("tbody tr[data-edit]")), n = 0;
    if (out) rows = rows.filter(function (tr) { var o = out(tr.getAttribute("data-id")); if (o) { n++; if (!tr.hidden) tr.hidden = true; } return !o; });
    if (col < 0 && !n) return null;
    return { bar: bar, tb: tb, col: col, c: c, rows: rows, out: n };
  }
  var stOf = function (T, tr) { return T.col < 0 ? "" : txt(tr.children[T.col]) || "(none)"; };

  function apply(T) {
    var want = T.col < 0 ? "" : pick[T.c] || "", shown = 0, part = !!want || T.out > 0;
    T.rows.forEach(function (tr) { var hide = !!want && stOf(T, tr) !== want; if (tr.hidden !== hide) tr.hidden = hide; if (!hide) shown++; });
    var cnt = [].slice.call(T.bar.querySelectorAll(".muted")).find(function (s) { return /^\d[\d,]* records?( of \d[\d,]*)?$/.test(txt(s)); });
    if (cnt) { var t = want ? shown + " record" + (shown === 1 ? "" : "s") + " of " + T.rows.length : T.rows.length + " record" + (T.rows.length === 1 ? "" : "s"); if (txt(cnt) !== t) cnt.textContent = t; }
    var ft = T.tb.querySelector("tfoot tr");
    if (ft) [].slice.call(ft.children).forEach(function (td, i) {
      if (!td.classList.contains("num")) return;
      if (!td.hasAttribute("data-stf0")) td.setAttribute("data-stf0", td.textContent);
      var v = part ? fmt(T.rows.reduce(function (s, tr) { return tr.hidden ? s : s + num(txt(tr.children[i])); }, 0)) : td.getAttribute("data-stf0");
      if (td.textContent !== v) td.textContent = v;
    });
  }

  function run() {
    var T = table(); if (!T) return;
    if (T.col < 0) { apply(T); return; }
    var counts = {}; T.rows.forEach(function (tr) { var s = stOf(T, tr); counts[s] = (counts[s] || 0) + 1; });
    var names = Object.keys(counts).sort();
    if (pick[T.c] && !counts[pick[T.c]]) names.push(pick[T.c]);
    var sel = document.getElementById("fsStF");
    var opts = "<option value=\"\">All statuses (" + T.rows.length + ")</option>" + names.map(function (s) {
      return "<option value=\"" + s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") + "\"" + (pick[T.c] === s ? " selected" : "") + ">" +
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;") + " (" + (counts[s] || 0) + ")</option>";
    }).join("");
    if (!sel) {
      var q = document.getElementById("q");
      var lab = document.createElement("label"); lab.className = "fs-stf"; lab.innerHTML = "Status <select id=\"fsStF\" aria-label=\"Filter by status\"></select>";
      q.insertAdjacentElement("afterend", lab); sel = lab.querySelector("select");
    }
    if (sel.getAttribute("data-c") !== T.c || sel.getAttribute("data-o") !== opts) { sel.innerHTML = opts; sel.setAttribute("data-c", T.c); sel.setAttribute("data-o", opts); }
    sel.classList.toggle("on", !!pick[T.c]);
    apply(T);
  }

  document.addEventListener("change", function (e) {
    if (!e.target || e.target.id !== "fsStF") return;
    var T = table(); if (!T) return;
    if (e.target.value) pick[T.c] = e.target.value; else delete pick[T.c];
    keep(); run();
  });
  var busy = false;
  (function watch() {
    if (!document.body) return setTimeout(watch, 300);
    new MutationObserver(function () {
      if (busy) return; busy = true;
      try { run(); } catch (e) { /* never break the app */ } finally { busy = false; }
    }).observe(document.body, { childList: true, subtree: true });
  })();
  var css = document.createElement("style");
  css.textContent = ".fs-stf{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#555}.fs-stf select{padding:6px 8px;border:1px solid #cfd6de;border-radius:8px;background:#fff;font:inherit;color:#222;max-width:220px}" +
    ".fs-stf select.on{border-color:#1F6FB8;box-shadow:0 0 0 2px rgba(31,111,184,.18);font-weight:600}@media print{.fs-stf{display:none}}";
  (document.head || document.documentElement).appendChild(css);
})();
