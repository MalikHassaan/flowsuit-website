// Bank reconciliation: cheque / transfer reference on every book entry (hassan, 2026-10-31: "payments are made through
// online portal or some through cheque"). The bank statement shows the cheque number or the portal's transaction
// reference, so each uncleared entry shows the voucher's "Cheque / TT / instrument no.", and a Find box narrows the list
// by reference, payee or amount.
// Date range (hassan, 2026-10-31: "in reconciliation there should be date range and once the date changes the opening
// and closing balance changes"): a From date next to the statement date, and a card with the account's opening balance,
// receipts, payments and closing balance in the books for that period. Entries before From that are still uncleared
// stay on the list (they are still outstanding) and are marked "brought forward".
(function () {
  /* global Store, V, render */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var lastQ = "";
  var jv = function (id) { return ((Store && Store.data && Store.data.journals) || []).find(function (j) { return j.id === id; }); };

  // Reversed pairs (hassan, 2026-11-18: "once the entry is reversed its impact should be reversed in all the system"):
  // a posted voucher and its posted reversal cancel out, so neither belongs on the uncleared list or in the period's
  // receipts and payments. Both stay in the ledger for the audit trail.
  function pairOf(j) {
    if (!j || j.status !== "Posted") return null;
    var m = j.reversedBy ? jv(j.reversedBy) : j.reversalOf ? jv(j.reversalOf) : null;
    return m && m.status === "Posted" && m.entity === j.entity && m.date ? m : null;
  }
  var amt = function (x) { var v = Math.round(Math.abs(x)).toLocaleString("en-US"); return x < -0.5 ? "(" + v + ")" : v; };
  var pad = function (x) { return ("0" + x).slice(-2); };
  function dayBefore(d) { var t = new Date(d + "T00:00:00"); t.setDate(t.getDate() - 1); return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()); }
  function fd(d) { var t = new Date(d + "T00:00:00"); return isNaN(t) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

  function range() {
    var to = document.getElementById("brDate"), acc = document.getElementById("brAcc");
    if (!to || !acc || typeof V === "undefined" || !V || !V.br) return;
    var ctls = to.closest(".ctls"); if (!ctls) return;
    var T = to.value; if (!T) return;
    // Any From and To date (hassan, 2026-11-18: "it should be general from any date can be selected from to till"): From
    // only gets a default (the 1st of the To month) the first time; after that it stays where it was put, whatever To is.
    if (!V.br.from) V.br.from = T.slice(0, 8) + "01";
    if (V.br.from > T) V.br.from = T;
    var Fr = V.br.from;
    if (!document.getElementById("fsBrFrom")) {
      var lab = to.closest("label");
      if (lab) {
        lab.insertAdjacentHTML("beforebegin", "<label for=\"fsBrFrom\">From <input type=\"date\" id=\"fsBrFrom\" value=\"" + esc(Fr) + "\"></label>");
        if (lab.firstChild && lab.firstChild.nodeType === 3) lab.firstChild.nodeValue = "To (statement date) ";
        document.getElementById("fsBrFrom").addEventListener("change", function (e) {
          var v = e.target.value; if (!v) return;
          V.br.from = v; if (v > T) V.br.date = v;
          if (typeof render === "function") render();
        });
      }
    }
    if (document.getElementById("fsBrRange")) return;
    var ent = V.ent, a = acc.value, open = 0, rin = 0, rout = 0, nin = 0, nout = 0;
    (Store.data.journals || []).forEach(function (j) {
      if (j.status !== "Posted" || j.entity !== ent || !j.date || j.date > T) return;
      var mate = pairOf(j);
      if (mate && j.date >= Fr && mate.date >= Fr && mate.date <= T) return; // reversed pair inside the period: nets to nil
      (j.lines || []).forEach(function (l) {
        if (l.account !== a) return;
        var d = +l.debit || 0, c = +l.credit || 0;
        if (j.date < Fr) open += d - c; else { if (d) { rin += d; nin++; } if (c) { rout += c; nout++; } }
      });
    });
    var close = open + rin - rout;
    ctls.insertAdjacentHTML("afterend", "<div class=\"card fs-brrange\" id=\"fsBrRange\"><h3>Bank account in the books, " + esc(fd(Fr)) + " to " + esc(fd(T)) + "</h3>" +
      "<div class=\"fs-brcells\"><div><span>Opening balance (" + esc(fd(dayBefore(Fr))) + ")</span><b>" + amt(open) + "</b></div>" +
      "<div><span>Receipts in the period (" + nin + ")</span><b class=\"in\">+ " + amt(rin) + "</b></div>" +
      "<div><span>Payments in the period (" + nout + ")</span><b class=\"out\">− " + amt(rout) + "</b></div>" +
      "<div class=\"tot\"><span>Closing balance (" + esc(fd(T)) + ")</span><b>" + amt(close) + "</b></div></div>" +
      "<p class=\"muted\" style=\"margin:6px 0 0\">Posted vouchers only. Compare the opening and closing balance with the same dates on the bank statement. Brackets mean an overdraft (credit balance).</p></div>");
  }

  function enhance() {
    if (typeof Store === "undefined" || !Store.data) return;
    range();
    var box = document.querySelector("input[data-brk]"); if (!box) return;
    var table = box.closest("table"); if (!table || table.dataset.fsRef) return;
    table.dataset.fsRef = "1";
    pairs(table);
    var head = table.querySelector("thead tr");
    if (head && head.children[2]) head.children[2].insertAdjacentHTML("afterend", "<th>Cheque / transfer ref</th>");
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var cb = tr.querySelector("input[data-brk]"); if (!cb || !tr.children[2]) return;
      var j = jv(String(cb.getAttribute("data-brk")).split(":")[0]) || {};
      var ref = String(j.chequeNo || "").trim();
      if (typeof V !== "undefined" && V && V.br && V.br.from && j.date && j.date < V.br.from && tr.children[1]) tr.children[1].insertAdjacentHTML("beforeend", "<br><span class=\"fs-bf\">brought forward</span>");
      tr.children[2].insertAdjacentHTML("afterend", "<td class=\"fs-bref\">" + (ref ? "<b>" + esc(ref) + "</b>" + (j.chequeDate ? "<br><span class=\"muted\">" + esc(j.chequeDate) + "</span>" : "") : "<span class=\"muted\">–</span>") + "</td>");
    });
    var wrap = table.closest(".panel") || table.parentNode;
    if (wrap && !document.getElementById("fsBrFind")) {
      wrap.insertAdjacentHTML("beforebegin", "<div class=\"fs-brfind\"><label for=\"fsBrFind\">Find on the list</label><input id=\"fsBrFind\" type=\"search\" autocomplete=\"off\" placeholder=\"Cheque no., portal reference, payee or amount\"><span class=\"muted\" id=\"fsBrCount\"></span></div>");
      var inp = document.getElementById("fsBrFind");
      inp.value = lastQ; if (lastQ) filter(table, lastQ);
      inp.addEventListener("input", function () { lastQ = inp.value; filter(table, inp.value); });
      inp.addEventListener("keydown", function (e) { e.stopPropagation(); });
    }
  }
  function pairs(table) {
    if (typeof V === "undefined" || !V || !V.br || !V.br.set) return;
    var byJ = {}, add = [], hid = 0, jn = {};
    table.querySelectorAll("input[data-brk]").forEach(function (cb) { var id = String(cb.getAttribute("data-brk")).split(":")[0]; (byJ[id] = byJ[id] || []).push(cb); });
    Object.keys(byJ).forEach(function (id) {
      var m = pairOf(jv(id)); if (!m || !byJ[m.id]) return; // both halves must be on this list
      byJ[id].forEach(function (cb) {
        var k = cb.getAttribute("data-brk"), tr = cb.closest("tr");
        if (!V.br.set.has(k)) add.push(k);
        if (tr) { tr.style.display = "none"; tr.classList.add("fs-brpair"); hid++; jn[id] = 1; }
      });
    });
    if (hid) {
      var tb = table.querySelector("tbody"), cols = (table.querySelector("thead tr") || {}).children;
      if (tb) tb.insertAdjacentHTML("beforeend", "<tr class=\"fs-brpairnote\"><td colspan=\"" + ((cols && cols.length) || 6) + "\" class=\"muted\">" + Math.ceil(Object.keys(jn).length / 2) + " reversed voucher pair" + (Object.keys(jn).length <= 2 ? "" : "s") + " left out: a voucher and its reversal cancel each other, so they are cleared automatically.</td></tr>");
    }
    if (add.length) { add.forEach(function (k) { V.br.set.add(k); }); setTimeout(function () { if (typeof render === "function") render(); }, 0); }
  }
  function filter(table, q) {
    q = String(q || "").toLowerCase().replace(/,/g, "").trim();
    var shown = 0, all = 0;
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      if (!tr.querySelector("input[data-brk]") || tr.classList.contains("fs-brpair")) return;
      all++;
      var ok = !q || tr.textContent.toLowerCase().replace(/,/g, "").indexOf(q) >= 0;
      tr.style.display = ok ? "" : "none"; if (ok) shown++;
    });
    var c = document.getElementById("fsBrCount"); if (c) c.textContent = q ? shown + " of " + all : "";
  }

  function start() {
    if (!document.body) return setTimeout(start, 50);
    new MutationObserver(function () { try { enhance(); } catch (x) { /* never break the page */ } })
      .observe(document.body, { childList: true, subtree: true });
    var css = document.createElement("style");
    css.textContent = ".fs-bref{font-family:Consolas,monospace;font-size:12.5px;white-space:nowrap}.fs-bref .muted{font-family:inherit;font-size:11px}" +
      ".fs-brrange{margin:10px 0}.fs-brrange h3{margin:0 0 8px}.fs-brcells{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}" +
      ".fs-brcells div{border:1px solid var(--line,#e2e8f0);border-radius:8px;padding:8px 10px}.fs-brcells span{display:block;font-size:12px;color:#64748b}.fs-brcells b{font-size:18px}" +
      ".fs-brcells b.in{color:#15803d}.fs-brcells b.out{color:#b91c1c}.fs-brcells .tot{background:#f1f5f9}@media(max-width:800px){.fs-brcells{grid-template-columns:1fr 1fr}}" +
      ".fs-bf{font-size:11px;color:#b45309;font-weight:600}" +
      ".fs-brfind{display:flex;align-items:center;gap:8px;margin:8px 0}.fs-brfind label{font-weight:600;font-size:13px}.fs-brfind input{flex:0 1 360px;padding:6px 9px;font:inherit}";
    document.head.appendChild(css);
  }
  start();
})();
