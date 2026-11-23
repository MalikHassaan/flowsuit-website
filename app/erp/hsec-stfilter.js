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
  // the status itself, without notes drawn under it (the GM's "Approved by ... on ..." on payment demands)
  var stOf = function (T, tr) {
    if (T.col < 0) return "";
    var td = tr.children[T.col], t = txt(td);
    [].slice.call(td.querySelectorAll(".fs-pdgm, .fs-revby")).forEach(function (x) { var u = txt(x); if (u) t = t.replace(u, "").trim(); });
    return t || "(none)";
  };
  // a pick is a status, "!status" (every other status) or "@id,id" (those records, e.g. approved today); the last two
  // come from the figure boxes above a list (hsec-demand.js) and carry a label for the picker
  var LAB = {};
  var keepRow = function (T, tr, want) {
    if (!want) return true;
    if (want.charAt(0) === "@") return want.slice(1).split(",").indexOf(tr.getAttribute("data-id")) >= 0;
    if (want.charAt(0) === "!") return stOf(T, tr) !== want.slice(1);
    return stOf(T, tr) === want;
  };
  // Month picker on Journals (hassan, 2026-11-23: "add month wise in vouchers, like in November how many vouchers are
  // created, all vouchers under the months"): All months, or one month with its count, newest first. It works with the
  // Status picker and the Office picker; the count and totals follow all of them. Months come from the voucher date.
  var MKEY = "fs-mof", mpick = (function () { try { return JSON.parse(sessionStorage.getItem(MKEY)) || {}; } catch (e) { return {}; } })();
  var mkeep = function () { try { sessionStorage.setItem(MKEY, JSON.stringify(mpick)); } catch (e) { /* private window */ } };
  var MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var mLabel = function (m) { return m === "-" ? "No date" : MN[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); };
  // The same picker sorts Projects (customer POs) by their type (hassan, 2026-11-23: "some are new installation some are
  // maintenance ... show in which category the PO is ... selection option all, New installation, category wise").
  var EXT = {
    journals: { word: "Month", all: "All months", desc: true, label: mLabel,
      key: function (r) { var d = String(r.date || ""); return /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : "-"; } },
    projects: { word: "Type", all: "All types", label: function (x) { return x === "-" ? "No type set" : x; },
      key: function (r) { return String(r.type || "").trim() || "-"; } }
  };
  function months(T) { // data-id -> the row's month (vouchers) or type (projects)
    var X = EXT[T.c]; if (!X) return null;
    var all = (typeof Store !== "undefined" && Store.data && Store.data[T.c]) || null; if (!all) return null;
    var by = {}; all.forEach(function (r) { by[r.id] = X.key(r); });
    return by;
  }
  // projects: a Category column after Project, so every PO shows its type (new installation, AMC ...)
  function tags(T) {
    if (T.c !== "projects" || !T.mon) return;
    var hr = T.tb.querySelector("thead tr"); if (!hr) return;
    var ths = [].slice.call(hr.children), col = ths.findIndex(function (th) { return /^project$/i.test(txt(th)); });
    if (col < 0) return;
    if (!hr.querySelector(".fs-catth")) {
      var th = document.createElement("th"); th.className = "fs-catth"; th.textContent = "Category"; hr.insertBefore(th, ths[col + 1] || null);
      [].slice.call(T.tb.querySelectorAll("tfoot tr")).forEach(function (fr) { var c = fr.children[col + 1], td = document.createElement("td"); td.className = "fs-cattd"; fr.insertBefore(td, c || null); });
    }
    T.tb.querySelectorAll("tbody tr").forEach(function (tr) {
      var td = tr.querySelector(":scope > td.fs-cattd");
      if (!td) { if (!tr.hasAttribute("data-edit")) return; td = document.createElement("td"); td.className = "fs-cattd"; tr.insertBefore(td, tr.children[col + 1] || null); }
      var ty = T.mon[tr.getAttribute("data-id")], t = ty && ty !== "-" ? ty : "";
      var tag = td.querySelector(".fs-tytag");
      if (!t) { if (tag) tag.remove(); return; }
      if (!tag) { tag = document.createElement("span"); tag.className = "fs-tytag"; td.appendChild(tag); }
      if (tag.textContent !== t) tag.textContent = t;
      var k = /AMC|maint/i.test(t) ? "amc" : /supply/i.test(t) ? "sup" : /service job/i.test(t) ? "svc" : /modern/i.test(t) ? "mod" : "new";
      if (tag.getAttribute("data-k") !== k) tag.setAttribute("data-k", k);
    });
    // a "no rows" line spans one more column
    T.tb.querySelectorAll("tbody td[colspan]").forEach(function (td) { if (!td.hasAttribute("data-fscs")) { td.setAttribute("data-fscs", "1"); td.colSpan = td.colSpan + 1; } });
  }
  var mOk = function (T, tr) { var w = T.mon && mpick[T.c]; return !w || T.mon[tr.getAttribute("data-id")] === w; };
  var special = function (v) { return v && (v.charAt(0) === "@" || v.charAt(0) === "!"); };

  function apply(T) {
    var want = T.col < 0 ? "" : pick[T.c] || "", shown = 0, mw = !!(T.mon && mpick[T.c]), part = !!want || mw || T.out > 0;
    T.rows.forEach(function (tr) { var hide = !keepRow(T, tr, want) || !mOk(T, tr); if (tr.hidden !== hide) tr.hidden = hide; if (!hide) shown++; });
    var cnt = [].slice.call(T.bar.querySelectorAll(".muted")).find(function (s) { return /^\d[\d,]* records?( of \d[\d,]*)?$/.test(txt(s)); });
    if (cnt) { var t = want || mw ? shown + " record" + (shown === 1 ? "" : "s") + " of " + T.rows.length : T.rows.length + " record" + (T.rows.length === 1 ? "" : "s"); if (txt(cnt) !== t) cnt.textContent = t; }
    var ft = T.tb.querySelector("tfoot tr");
    if (ft) [].slice.call(ft.children).forEach(function (td, i) {
      if (!td.classList.contains("num")) return;
      if (!td.hasAttribute("data-stf0")) td.setAttribute("data-stf0", td.textContent);
      var v = part ? fmt(T.rows.reduce(function (s, tr) { return tr.hidden ? s : s + num(txt(tr.children[i])); }, 0)) : td.getAttribute("data-stf0");
      if (td.textContent !== v) td.textContent = v;
    });
  }

  function monthSel(T) {
    var sel = document.getElementById("fsMoF");
    if (!T.mon) { if (sel) sel.closest("label").remove(); return; }
    var want = T.col < 0 ? "" : pick[T.c] || "", counts = {};
    T.rows.forEach(function (tr) { if (!keepRow(T, tr, want)) return; var m = T.mon[tr.getAttribute("data-id")] || "-"; counts[m] = (counts[m] || 0) + 1; });
    var X = EXT[T.c], ms = Object.keys(counts).sort(), cur = mpick[T.c] || "", tot = ms.reduce(function (a, m) { return a + counts[m]; }, 0);
    if (X.desc) ms.reverse();
    if (cur && !counts[cur]) ms.unshift(cur);
    var q = function (v) { return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); };
    var opts = "<option value=\"\">" + X.all + " (" + tot + ")</option>" + ms.map(function (m) { return "<option value=\"" + q(m) + "\"" + (m === cur ? " selected" : "") + ">" + q(X.label(m)) + " (" + (counts[m] || 0) + ")</option>"; }).join("");
    if (!sel) {
      var anchor = document.getElementById("fsStF"); anchor = anchor ? anchor.closest("label") : document.getElementById("q");
      var lab = document.createElement("label"); lab.className = "fs-stf"; lab.innerHTML = X.word + " <select id=\"fsMoF\" aria-label=\"Filter by " + X.word.toLowerCase() + "\"></select>";
      anchor.insertAdjacentElement("afterend", lab); sel = lab.querySelector("select");
    }
    if (sel.getAttribute("data-c") !== T.c || sel.getAttribute("data-o") !== opts) { sel.innerHTML = opts; sel.setAttribute("data-c", T.c); sel.setAttribute("data-o", opts); }
    var lw = sel.closest("label").firstChild; if (lw && lw.nodeType === 3 && lw.nodeValue !== X.word + " ") lw.nodeValue = X.word + " ";
    sel.classList.toggle("on", !!cur);
  }
  function run() {
    var T = table(); if (!T) { var ms = document.getElementById("fsMoF"); if (ms) ms.closest("label").remove(); return; }
    T.mon = months(T);
    if (T.c === "projects" && T.mon) { tags(T); T = table(); if (!T) return; T.mon = months(T); } // column added first, then indexes read again
    if (T.col < 0) { monthSel(T); apply(T); return; }
    var counts = {}; T.rows.forEach(function (tr) { var s = stOf(T, tr); counts[s] = (counts[s] || 0) + 1; });
    var names = Object.keys(counts).sort();
    var cur = pick[T.c] || "";
    if (cur && !special(cur) && !counts[cur]) names.push(cur);
    var sel = document.getElementById("fsStF");
    var opts = "<option value=\"\">All statuses (" + T.rows.length + ")</option>" + names.map(function (s) {
      return "<option value=\"" + s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") + "\"" + (pick[T.c] === s ? " selected" : "") + ">" +
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;") + " (" + (counts[s] || 0) + ")</option>";
    }).join("") + (special(cur) ? "<option value=\"" + cur.replace(/"/g, "&quot;") + "\" selected>" + String(LAB[cur] || (cur.charAt(0) === "!" ? "All except " + cur.slice(1) : "Picked above")).replace(/&/g, "&amp;").replace(/</g, "&lt;") + " (" +
      T.rows.filter(function (tr) { return keepRow(T, tr, cur); }).length + ")</option>" : "");
    if (!sel) {
      var q = document.getElementById("q");
      var lab = document.createElement("label"); lab.className = "fs-stf"; lab.innerHTML = "Status <select id=\"fsStF\" aria-label=\"Filter by status\"></select>";
      q.insertAdjacentElement("afterend", lab); sel = lab.querySelector("select");
    }
    if (sel.getAttribute("data-c") !== T.c || sel.getAttribute("data-o") !== opts) { sel.innerHTML = opts; sel.setAttribute("data-c", T.c); sel.setAttribute("data-o", opts); }
    sel.classList.toggle("on", !!pick[T.c]);
    monthSel(T);
    apply(T);
  }

  // for the figure boxes above a list: show only these rows, or all again ("")
  window.FS_STF = {
    set: function (v, label) {
      var T = table(); if (!T) return false;
      if (label) LAB[v] = label;
      if (v) pick[T.c] = v; else delete pick[T.c];
      keep(); run(); return true;
    },
    get: function (c) { return pick[c] || ""; }
  };
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "fsMoF") { var M = table(); if (!M) return; if (e.target.value) mpick[M.c] = e.target.value; else delete mpick[M.c]; mkeep(); run(); return; }
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
    ".fs-tytag{display:inline-block;margin-top:4px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;line-height:18px;background:#e0ecf8;color:#1F6FB8;white-space:nowrap}" +
    ".fs-tytag[data-k=amc]{background:#dcfce7;color:#15803d}.fs-tytag[data-k=sup]{background:#fef3c7;color:#92400e}.fs-tytag[data-k=svc]{background:#ede9fe;color:#6d28d9}.fs-tytag[data-k=mod]{background:#e0f2fe;color:#0369a1}" +
    ".fs-cattd .fs-tytag{margin-top:0;white-space:normal}" +
    ".fs-stf select.on{border-color:#1F6FB8;box-shadow:0 0 0 2px rgba(31,111,184,.18);font-weight:600}@media print{.fs-stf{display:none}}";
  (document.head || document.documentElement).appendChild(css);
})();
