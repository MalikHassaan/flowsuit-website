// Bank reconciliation: cheque / transfer reference on every book entry (hassan, 2026-10-31: "payments are made through
// online portal or some through cheque"). The bank statement shows the cheque number or the portal's transaction
// reference, so each uncleared entry shows the voucher's "Cheque / TT / instrument no.", and a Find box narrows the list
// by reference, payee or amount.
// Date range (hassan, 2026-10-31: "in reconciliation there should be date range and once the date changes the opening
// and closing balance changes"): a From date next to the statement date, and a card with the account's opening balance,
// receipts, payments and closing balance in the books for that period. Entries before From that are still uncleared
// stay on the list (they are still outstanding) and are marked "brought forward".
(function () {
  /* global Store, V, render, F, toast, approverName */
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
    // Blank dates until picked (hassan, 2026-11-19: "the dates are fixed in October, it should be blank where the user
    // can see it and then select it"): the app fills the statement date with last month's end, so until the To date is
    // picked on this visit both boxes show empty and the reconciliation below stays hidden.
    if (!picked) {
      if (!document.getElementById("fsBrFrom")) {
        var lb0 = to.closest("label");
        if (lb0) {
          lb0.insertAdjacentHTML("beforebegin", "<label for=\"fsBrFrom\">From <input type=\"date\" id=\"fsBrFrom\" value=\"" + esc(fromPick || "") + "\"></label>");
          if (lb0.firstChild && lb0.firstChild.nodeType === 3) lb0.firstChild.nodeValue = "To (statement date) ";
        }
      }
      return;
    }
    var T = to.value; if (!T) return;
    if (fromPick) { V.br.from = fromPick; fromPick = ""; }
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

  var picked = false, fromPick = "";
  // the From box (made here, so one listener for it)
  document.addEventListener("change", function (e) {
    if (!e.target || e.target.id !== "fsBrFrom" || typeof V === "undefined" || !V || !V.br) return;
    var v = e.target.value; if (!v) return;
    if (!picked) { fromPick = v; return; }
    var T = (document.getElementById("brDate") || {}).value || "";
    V.br.from = v; if (T && v > T) V.br.date = v;
    if (typeof render === "function") render();
  });
  // picking the To date (the app's own statement date) opens the reconciliation; a new company starts blank again
  ["input", "change"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (e.target && e.target.id === "brDate" && e.target.value) picked = true; }, true);
  });
  var lastEnt = null;
  function gate() {
    var to = document.getElementById("brDate"); if (!to) return false;
    if (typeof V !== "undefined" && V && V.ent !== lastEnt) { if (lastEnt !== null) { picked = false; fromPick = ""; } lastEnt = V.ent; }
    var ctls = to.closest(".ctls"), msg = document.getElementById("fsBrPick");
    if (picked) { if (msg) msg.remove(); return false; }
    if (to.value) to.value = "";
    if (ctls) {
      var el = ctls.nextElementSibling;
      while (el) { if (el.id !== "fsBrPick" && el.style.display !== "none") el.style.display = "none"; el = el.nextElementSibling; }
      if (!msg) ctls.insertAdjacentHTML("afterend", "<div class=\"panel fs-brpick\" id=\"fsBrPick\"><b>Choose the dates to start</b><br>Pick the From date and the To (statement) date above. The balances, the entries and the earlier reconciliations show once the To date is picked.</div>");
    }
    return true;
  }
  function enhance() {
    if (typeof Store === "undefined" || !Store.data) return;
    jvMark();
    if (gate()) { range(); return; }
    range();
    lock();
    doneHint();
    loadCounts();
    history();
    stmtFiles();
    var box = [].slice.call(document.querySelectorAll("input[data-brk]")).find(function (x) { return !x.closest("#fsBrCl"); }); if (!box) return;
    var table = box.closest("table"); if (!table || table.dataset.fsRef) return;
    table.dataset.fsRef = "1";
    pairs(table);
    openings(table);
    var head = table.querySelector("thead tr");
    if (head && head.children[2]) head.children[2].insertAdjacentHTML("afterend", "<th>Cheque / transfer ref</th>");
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var cb = tr.querySelector("input[data-brk]"); if (!cb || !tr.children[2]) return;
      var j = jv(String(cb.getAttribute("data-brk")).split(":")[0]) || {};
      var ref = String(j.chequeNo || "").trim();
      if (typeof V !== "undefined" && V && V.br && V.br.from && j.date && j.date < V.br.from && tr.children[1]) tr.children[1].insertAdjacentHTML("beforeend", "<br><span class=\"fs-bf\">brought forward</span>");
      tr.children[2].insertAdjacentHTML("afterend", "<td class=\"fs-bref\">" + (ref ? "<b>" + esc(ref) + "</b>" + (j.chequeDate ? "<br><span class=\"muted\">" + esc(j.chequeDate) + "</span>" : "") : "<span class=\"muted\">–</span>") + "</td>");
    });
    cleared(table);
    var wrap = table.closest(".panel") || table.parentNode;
    if (wrap && !document.getElementById("fsBrFind")) {
      wrap.insertAdjacentHTML("beforebegin", "<div class=\"fs-brfind\"><label for=\"fsBrFind\">Find on the list</label><input id=\"fsBrFind\" type=\"search\" autocomplete=\"off\" placeholder=\"Cheque no., portal reference, payee or amount\"><span class=\"muted\" id=\"fsBrCount\"></span></div>");
      var inp = document.getElementById("fsBrFind");
      inp.value = lastQ; if (lastQ) filter(table, lastQ);
      inp.addEventListener("input", function () { lastQ = inp.value; filter(table, inp.value); });
      inp.addEventListener("keydown", function (e) { e.stopPropagation(); });
    }
    tabs(table);
  }
  // Two tabs (hassan, 2026-11-19: "there should be two tabs, one reconciled transactions and other unreconciled
  // transactions; once a transaction is marked it should go into the reconciled tab, where the balances are, and that
  // balance should be equal to our bank statement"). Ticking moves an entry across; the counts are on the tabs.
  var tab = "un", SUM = null;
  // Payments still to be made from this bank (hassan, 2026-11-19: "the difference should state how much pending payments
  // are there which need to be cleared"): payment demands of this company whose demand JV is posted but whose bank
  // payment is not posted yet, either not paid at all or with its BPV still in approval, and set to this bank or to no
  // bank yet. They are not in the bank account until the BPV posts; then they appear on Unreconciled with the BPV number.
  function pendingPays(acc, ent) {
    var J = Store.data.journals || [], out = [];
    (Store.data.paydemands || []).forEach(function (d) {
      if ((d.payCo || d.entity) !== ent || (d.bank && d.bank !== acc)) return;
      var mine = J.filter(function (j) { return j.source && j.source.c === "paydemands" && j.source.id === d.id && !j.reversedBy && !j.reversalOf && j.status !== "Rejected"; });
      var jvA = mine.find(function (j) { return j.source.ev === "accrue"; }), bp = mine.find(function (j) { return j.source.ev === "pay"; });
      if (!jvA || jvA.status !== "Posted" || (bp && bp.status === "Posted")) return;
      if (d.gm && d.gm.status === "Not approved") return;
      out.push({ d: d, jv: jvA, bp: bp, st: bp ? (bp.ref || "BPV") + " in approval" : d.gm && d.gm.status === "Approved" ? "Approved, to be paid" : "Waiting for GM approval" });
    });
    return out.sort(function (a, b) { return String(a.d.date).localeCompare(String(b.d.date)); });
  }
  function tabs(table) {
    var panel = table.closest(".panel") || table.parentNode, cl = document.getElementById("fsBrCl"); if (!panel || !cl) return;
    var head = [].slice.call(document.querySelectorAll(".ctls h3")).find(function (h) { return /not yet cleared/i.test(h.textContent); });
    head = head && head.closest(".ctls");
    var find = document.querySelector(".fs-brfind");
    var nUn = [].slice.call(table.querySelectorAll("tbody tr")).filter(function (tr) { var cb = tr.querySelector("input[data-brk]"); return cb && !cb.checked && !/fs-br(pair|open|early)/.test(tr.className); }).length;
    var nCl = cl.querySelectorAll("input[data-brk]").length;
    var acc = (document.getElementById("brAcc") || {}).value || "", pend = pendingPays(acc, V.ent), pTot = pend.reduce(function (t, x) { return t + (+x.d.amount || 0); }, 0);
    // the summary: books = reconciled + unreconciled; then what is still to be paid
    var sum = document.getElementById("fsBrSum");
    if (SUM) {
      var shtml = "<div class=\"fs-brcells fs-brsum5\"><div><span>Bank ledger balance (books)</span><b>" + amt(SUM.book) + "</b></div>" +
        "<div><span>Reconciled (on the statement)</span><b>" + amt(SUM.run) + "</b></div>" +
        "<div><span>Unreconciled: receipts (" + SUM.nIn + ") not yet in the bank</span><b class=\"in\">+ " + amt(SUM.uIn) + "</b></div>" +
        "<div><span>Unreconciled: payments (" + SUM.nOut + ") not yet presented</span><b class=\"out\">− " + amt(SUM.uOut) + "</b></div>" +
        "<div class=\"tot\"><span>Payments still to be made (" + pend.length + " demands)</span><b class=\"out\">− " + amt(pTot) + "</b></div></div>" +
        "<p class=\"muted\" style=\"margin:6px 0 0\">Books " + amt(SUM.book) + " = reconciled " + amt(SUM.run) + " + unreconciled receipts " + amt(SUM.uIn) + " − unreconciled payments " + amt(SUM.uOut) +
        ". After the " + pend.length + " payments still to be made, the bank will be about <b>" + amt(SUM.book - pTot) + "</b>.</p>";
      if (!sum) { (document.getElementById("fsBrTabs") || head || panel).insertAdjacentHTML("beforebegin", "<div class=\"card fs-brsumc\" id=\"fsBrSum\"><h3>Where the bank balance stands</h3><div></div></div>"); sum = document.getElementById("fsBrSum"); }
      var sb = sum.lastElementChild; if (sb.innerHTML !== shtml) sb.innerHTML = shtml;
    }
    var pp = document.getElementById("fsBrPend");
    var phtml = "<h3>Payments still to be made from this bank · " + pend.length + "</h3>" + (pend.length ? "<table><thead><tr><th>Demand</th><th>Date</th><th>Pay to</th><th>For</th><th>Stage</th><th class=\"num\">Amount</th></tr></thead><tbody>" +
      pend.map(function (x) { return "<tr><td class=\"mono\">" + esc(x.d.demandNo || "") + "</td><td>" + esc(fd(x.d.date)) + "</td><td>" + esc(x.d.payee || "") + "</td><td>" + esc(String(x.d.description || "").slice(0, 70)) + "</td><td>" + esc(x.st) + "</td><td class=\"num\">" + amt(+x.d.amount || 0) + "</td></tr>"; }).join("") +
      "</tbody><tfoot><tr><td colspan=\"5\">Total still to be paid</td><td class=\"num\"><b>" + amt(pTot) + "</b></td></tr></tfoot></table><p class=\"muted\" style=\"margin:6px 12px 10px\">Booked as payables (demand JV posted) but not paid from the bank yet. Once its bank payment voucher is posted, a demand leaves this list and shows on Unreconciled with the BPV number.</p>" :
      "<p class=\"muted\" style=\"margin:0 12px 12px\">No approved payment demands waiting to be paid from this bank.</p>");
    if (!pp) { cl.insertAdjacentHTML("afterend", "<div class=\"panel tw fs-brcl\" id=\"fsBrPend\"></div>"); pp = document.getElementById("fsBrPend"); }
    if (pp.innerHTML !== phtml) pp.innerHTML = phtml;
    var bar = document.getElementById("fsBrTabs");
    if (!bar) { (head || find || panel).insertAdjacentHTML("beforebegin", "<div class=\"fs-brtabs\" id=\"fsBrTabs\" role=\"tablist\"></div>"); bar = document.getElementById("fsBrTabs"); }
    var html = "<button type=\"button\" role=\"tab\" data-fsbrtab=\"un\" aria-selected=\"" + (tab === "un") + "\">Unreconciled transactions <span>" + nUn + "</span></button>" +
      "<button type=\"button\" role=\"tab\" data-fsbrtab=\"cl\" aria-selected=\"" + (tab === "cl") + "\">Reconciled transactions <span>" + nCl + "</span></button>" +
      "<button type=\"button\" role=\"tab\" data-fsbrtab=\"pp\" aria-selected=\"" + (tab === "pp") + "\">Payments still to be made <span>" + pend.length + "</span></button>";
    if (bar.innerHTML !== html) bar.innerHTML = html;
    var showUn = tab === "un";
    [head, find, panel].forEach(function (el) { if (el) { var w = showUn ? "" : "none"; if (el.style.display !== w) el.style.display = w; } });
    var w2 = tab === "cl" ? "" : "none"; if (cl.style.display !== w2) cl.style.display = w2;
    var w3 = tab === "pp" ? "" : "none"; if (pp.style.display !== w3) pp.style.display = w3;
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-fsbrtab]"); if (!b) return;
    tab = b.getAttribute("data-fsbrtab");
    var box = [].slice.call(document.querySelectorAll("input[data-brk]")).find(function (x) { return !x.closest("#fsBrCl"); });
    var t = box && box.closest("table"); if (t) tabs(t);
  });
  // "Mark reconciled" is refused until the statement's closing balance is entered and the difference is nil; the app
  // gives no reason, so say which one is missing (hassan, 2026-11-18: "mark reconciliation button is not working").
  // Two lists (hassan, 2026-11-18: "there should be two tables, one reconciled entries and other unreconciled entries,
  // and the reconciled balance should be equal to the closing balance of the statement"). Ticked entries move to an
  // "On the bank statement" table with a running balance. It starts from the balance brought forward (what the bank held
  // before these entries: books less everything listed here) and must end on the statement's closing balance.
  // Opening balance fixed (hassan, 2026-11-18: "once the opening balance is entered it should be fixed ... why do we need
  // to enter the opening balance every time"). A voucher marked Opening balance = Yes, or narrated "Opening ...", on this
  // bank account is the bank's starting point, not an item to find on a statement: it is ticked automatically, taken
  // off both lists and shown as the opening line that the ticked entries run on from.
  var isOpen = function (j) { return !!j && (j.opening === "Yes" || /^\s*opening\b/i.test(String(j.narration || ""))); };
  function openings(table) {
    if (typeof V === "undefined" || !V || !V.br || !V.br.set) return;
    var add = [];
    table.querySelectorAll("input[data-brk]").forEach(function (cb) {
      var k = cb.getAttribute("data-brk"), j = jv(String(k).split(":")[0]), tr = cb.closest("tr");
      if (!isOpen(j) || !tr || tr.classList.contains("fs-brpair")) return;
      tr.style.display = "none"; tr.classList.add("fs-bropen");
      if (!V.br.set.has(k)) add.push(k);
    });
    if (add.length) { add.forEach(function (k) { V.br.set.add(k); }); setTimeout(function () { if (typeof render === "function") render(); }, 0); }
  }
  function cleared(table) {
    var old = document.getElementById("fsBrCl"); if (old) old.remove();
    var acc = document.getElementById("brAcc"), to = document.getElementById("brDate"); if (!acc || !to || !to.value) return;
    var a = acc.value, T = to.value, ent = V.ent, book = 0, listed = 0;
    (Store.data.journals || []).forEach(function (j) {
      if (j.status !== "Posted" || j.entity !== ent || !j.date || j.date > T) return;
      (j.lines || []).forEach(function (l) { if (l.account === a) book += (+l.debit || 0) - (+l.credit || 0); });
    });
    var lineAmt = function (k) { var p = String(k).split(":"), j = jv(p[0]), l = j && (j.lines || [])[+p[1]]; return l ? (+l.debit || 0) - (+l.credit || 0) : 0; };
    var rows = [], opn = [], early = 0, uIn = 0, uOut = 0, nIn = 0, nOut = 0, Fr = V.br && V.br.from && V.br.from <= T ? V.br.from : "";
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var cb = tr.querySelector("input[data-brk]"); if (!cb) return;
      var v = lineAmt(cb.getAttribute("data-brk"));
      if (tr.classList.contains("fs-bropen")) { opn.push(jv(String(cb.getAttribute("data-brk")).split(":")[0])); return; }
      listed += v;
      if (!cb.checked && !tr.classList.contains("fs-brpair")) { if (v > 0) { uIn += v; nIn++; } else { uOut -= v; nOut++; } }
      if (cb.checked && !tr.classList.contains("fs-brpair")) { var jd = (jv(String(cb.getAttribute("data-brk")).split(":")[0]) || {}).date || ""; if (Fr && jd && jd < Fr) { early += v; tr.style.display = "none"; tr.classList.add("fs-brearly"); } else rows.push({ tr: tr, v: v }); }
    });
    var bf = book - listed + early, cols = (table.querySelector("thead tr") || { children: [] }).children.length || 7;
    var bal = document.getElementById("brBal"), sv = bal ? String(bal.value).replace(/,/g, "").trim() : "", stmt = sv === "" ? null : parseFloat(sv.replace(/^\((.*)\)$/, "-$1"));
    var head = table.querySelector("thead") ? table.querySelector("thead").outerHTML.replace("</tr>", "<th class=\"num\">Balance</th></tr>") : "";
    var run = bf, rin = 0, rout = 0;
    var div = document.createElement("div"); div.id = "fsBrCl"; div.className = "panel tw fs-brcl";
    div.innerHTML = "<h3>On the bank statement (ticked) · " + rows.length + "</h3><table>" + head + "<tbody></tbody><tfoot></tfoot></table>";
    var tb = div.querySelector("tbody");
    tb.insertAdjacentHTML("beforeend", "<tr class=\"fs-brbf\"><td colspan=\"" + cols + "\">" + (Fr ? "Opening balance on the bank at " + esc(fd(dayBefore(Fr))) + " (" + (opn.length ? "opening voucher " + opn.map(function (j) { return esc((j && j.ref) || ""); }).join(", ") + ", " : "") + "plus entries cleared before " + esc(fd(Fr)) + "). It moves with the From date" : opn.length ? "Opening balance (" + opn.map(function (j) { return esc((j && j.ref) || "") + (j && j.date ? ", " + esc(fd(j.date)) : ""); }).join("; ") + ") and anything cleared on earlier statements. Fixed: it is not ticked again" : "Balance brought forward (cleared on earlier statements; 0 for a new account)") + "</td><td class=\"num\"><b>" + amt(bf) + "</b></td></tr>");
    rows.forEach(function (r) {
      run += r.v; if (r.v > 0) rin += r.v; else rout -= r.v;
      r.tr.insertAdjacentHTML("beforeend", "<td class=\"num\">" + amt(run) + "</td>");
      tb.appendChild(r.tr);
    });
    if (!rows.length) tb.insertAdjacentHTML("beforeend", "<tr><td colspan=\"" + (cols + 1) + "\" class=\"muted\">Nothing ticked yet. Tick each entry below that appears on the bank statement.</td></tr>");
    SUM = { book: book, run: run, uIn: uIn, uOut: uOut, nIn: nIn, nOut: nOut, acc: a, T: T };
    var diff = stmt === null || isNaN(stmt) ? null : stmt - run, ok = diff !== null && Math.abs(diff) < 1;
    div.querySelector("tfoot").innerHTML =
      "<tr><td colspan=\"" + cols + "\">Balance per ticked entries (brought forward + " + amt(rin) + " received − " + amt(rout) + " paid)</td><td class=\"num\"><b>" + amt(run) + "</b></td></tr>" +
      "<tr><td colspan=\"" + cols + "\">Closing balance per bank statement</td><td class=\"num\">" + (diff === null ? "<span class=\"muted\">Enter it above</span>" : amt(stmt)) + "</td></tr>" +
      "<tr class=\"" + (diff === null ? "" : ok ? "fs-brok" : "fs-brbad") + "\"><td colspan=\"" + cols + "\">" + (diff === null ? "Difference" : ok ? "Difference: none, the ticked entries agree with the statement" : "Difference: entries on the statement but not in the books (bank charges, profit), or a wrong tick") + "</td><td class=\"num\"><b>" + (diff === null ? "" : amt(diff)) + "</b></td></tr>";
    var panel = table.closest(".panel") || table.parentNode;
    panel.insertAdjacentElement("afterend", div);
  }
  // Earlier reconciliations (hassan, 2026-11-18: "instead of showing [the difference] show the reconciled entries and
  // amount with it"): statement balance, books, the entries cleared on it (count and amounts) and its files; click a row
  // to see the entries.
  var openRec = "";
  var recId = function (ent, code, date) { return (ent + "_" + code + "_" + date).replace(/[^A-Za-z0-9_\-.~:@+]/g, "-"); };
  function keyAmt(k) { var p = String(k).split(":"), j = jv(p[0]), l = j && (j.lines || [])[+p[1]]; return { j: j, v: l ? (+l.debit || 0) - (+l.credit || 0) : 0 }; }
  function history() {
    var h3 = [].slice.call(document.querySelectorAll(".card h3")).find(function (x) { return /^\s*Earlier reconciliations/i.test(x.textContent); });
    if (!h3) return;
    var card = h3.closest(".card"); if (!card || card.getAttribute("data-fshist") === openRec + "|" + attSig) return;
    var recs = (Store.data.bankrecs || []).filter(function (r) { return r.entity === V.ent; }).sort(function (a, b) { return String(b.stmtDate).localeCompare(String(a.stmtDate)); }).slice(0, 12);
    if (!recs.length) return;
    var html = "<div class=\"tw\"><table class=\"fs-brhist\"><thead><tr><th>Account</th><th>Statement date</th><th class=\"num\">Statement balance</th><th class=\"num\">Books</th><th>Entries cleared</th><th>Status</th><th>Files</th></tr></thead><tbody>";
    recs.forEach(function (r) {
      var cl = (r.cleared || []).map(keyAmt).filter(function (x) { return x.j; }), rin = 0, rout = 0;
      cl.forEach(function (x) { if (x.v > 0) rin += x.v; else rout -= x.v; });
      var nf = attCount["bankrecs/" + r.id] || 0;
      html += "<tr class=\"click\" data-fsrec=\"" + esc(r.id) + "\"><td>" + esc(r.accCode) + "</td><td>" + esc(fd(r.stmtDate)) + "</td><td class=\"num\">" + amt(+r.stmtBalance || 0) + "</td><td class=\"num\">" + amt(+r.book || 0) + "</td>" +
        "<td>" + cl.length + (cl.length ? " <span class=\"muted\">(+" + amt(rin) + " / −" + amt(rout) + ")</span>" : "") + "</td>" +
        "<td><span class=\"pill " + (r.status === "Reconciled" ? "good" : "warn") + "\">" + esc(r.status || "") + "</span></td><td>" + (nf ? "📎 " + nf : "<span class=\"muted\">–</span>") + "</td></tr>";
      if (openRec === r.id) {
        html += "<tr class=\"fs-brhistx\"><td colspan=\"7\">" + (cl.length ? "<table><thead><tr><th>Date</th><th>Voucher</th><th>Payee / narration</th><th class=\"num\">Receipt</th><th class=\"num\">Payment</th></tr></thead><tbody>" +
          cl.sort(function (a, b) { return String(a.j.date).localeCompare(String(b.j.date)); }).map(function (x) {
            return "<tr><td>" + esc(fd(x.j.date)) + "</td><td class=\"mono\">" + esc(x.j.ref || "") + "</td><td>" + esc(((x.j.payee ? x.j.payee + " – " : "") + String(x.j.narration || "")).slice(0, 80)) + "</td><td class=\"num\">" + (x.v > 0 ? amt(x.v) : "") + "</td><td class=\"num\">" + (x.v < 0 ? amt(-x.v) : "") + "</td></tr>";
          }).join("") + "</tbody></table>" : "<span class=\"muted\">No entries were ticked on this reconciliation.</span>") +
          "<div class=\"fs-brhistf\" data-fsrecf=\"" + esc(r.id) + "\"></div></td></tr>";
      }
    });
    html += "</tbody></table></div><p class=\"muted\" style=\"margin:6px 0 0\">Click a row to see the entries cleared on it and the attached statement.</p>";
    while (card.children.length > 1) card.removeChild(card.lastChild);
    card.insertAdjacentHTML("beforeend", html);
    card.setAttribute("data-fshist", openRec + "|" + attSig);
    var fbox = card.querySelector("[data-fsrecf]");
    if (fbox && window.FS_ATT) window.FS_ATT.files(["bankrecs/" + openRec]).then(function (list) {
      fbox.innerHTML = list.length ? "<b>Bank statement</b><div class=\"fs-attgrid\">" + list.map(function (f) { return window.FS_ATT.tile(f, true); }).join("") + "</div>" : "";
    }).catch(function () {});
  }
  // counts of files per reconciliation, for the Files column
  var attCount = {}, attSig = "", attAsked = 0;
  function loadCounts() {
    var C = window.FS_BRIDGE || {};
    if (Date.now() - attAsked < 20000) return; attAsked = Date.now();
    fetch((C.api || "/erp/m/hsec/api") + "/att/index", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
      attCount = d.counts || {}; attSig = JSON.stringify(Object.keys(attCount).filter(function (k) { return /^bankrecs\//.test(k); }).map(function (k) { return k + attCount[k]; }));
      var c = document.querySelector("[data-fshist]"); if (c) c.removeAttribute("data-fshist");
      history();
    }).catch(function () {});
  }
  document.addEventListener("click", function (e) {
    var tr = e.target.closest && e.target.closest("tr[data-fsrec]"); if (!tr) return;
    var id = tr.getAttribute("data-fsrec"); openRec = openRec === id ? "" : id;
    var c = document.querySelector("[data-fshist]"); if (c) c.removeAttribute("data-fshist");
    history();
  });

  // Bank statement on the reconciliation (hassan, 2026-11-18: "add attachment option so that on daily reconciliation the
  // attachment can be entered"): photos or PDFs of the statement are kept with that day's reconciliation. It has to be
  // saved first (Save draft or Mark reconciled), because the files belong to the saved reconciliation.
  var stmtShown = "";
  function stmtFiles() {
    var b = document.getElementById("brDone"), acc = document.getElementById("brAcc"), to = document.getElementById("brDate");
    if (!b || !acc || !to || !window.FS_ATT) return;
    var a = (Store.data.accounts || []).find(function (x) { return x.id === acc.value; }); if (!a) return;
    var id = recId(V.ent, a.code, to.value), saved = (Store.data.bankrecs || []).some(function (r) { return r.id === id; });
    var box = document.getElementById("fsBrAtt");
    if (box && box.getAttribute("data-k") === id + "|" + saved + "|" + attSig) return;
    if (!box) {
      var anchor = document.getElementById("fsBrWhy") || b.parentNode;
      anchor.insertAdjacentHTML("afterend", "<div class=\"fs-attbox fs-bratt\" id=\"fsBrAtt\"></div>");
      box = document.getElementById("fsBrAtt");
    }
    box.setAttribute("data-k", id + "|" + saved + "|" + attSig);
    var head = "<div class=\"fs-atthd\"><b>Bank statement for " + esc(fd(to.value)) + "</b>" +
      (saved && window.FS_ATT.canEdit() ? "<label class=\"btn sm\">Attach statement (photo or PDF)<input type=\"file\" id=\"fsBrPick\" accept=\"image/*,application/pdf\" multiple hidden></label>" : "") +
      "<span class=\"fs-attmsg\" id=\"fsBrMsg\"></span></div>";
    if (!saved) { box.innerHTML = head + "<p class=\"muted fs-attnone\">Click Save draft first, then attach the statement here.</p>"; return; }
    box.innerHTML = head + "<div class=\"fs-attgrid\"></div>";
    window.FS_ATT.files(["bankrecs/" + id]).then(function (list) {
      var g = box.querySelector(".fs-attgrid"); if (!g) return;
      g.innerHTML = list.length ? list.map(function (f) { return window.FS_ATT.tile(f, true); }).join("") : "<p class=\"muted fs-attnone\">No statement attached yet.</p>";
    }).catch(function () {});
  }
  document.addEventListener("change", function (e) {
    if (!e.target || e.target.id !== "fsBrPick" || !window.FS_ATT) return;
    var box = document.getElementById("fsBrAtt"), k = box && String(box.getAttribute("data-k")).split("|")[0]; if (!k) return;
    var list = [].slice.call(e.target.files || []), msg = document.getElementById("fsBrMsg");
    var say = function (t) { if (msg) msg.textContent = t; };
    window.FS_ATT.upload("bankrecs/" + k, list, say).then(function (errs) {
      say(errs.length ? errs.join(" ") : "Attached."); attAsked = 0; box.removeAttribute("data-k"); loadCounts(); stmtFiles();
    });
  });
  document.addEventListener("fs-att", function () { window.FS_ATT && window.FS_ATT.forget("bankrecs/" + openRec); attAsked = 0; var b = document.getElementById("fsBrAtt"); if (b) b.removeAttribute("data-k"); loadCounts(); stmtFiles(); });
  function doneHint() {
    var b = document.getElementById("brDone"); if (!b) return;
    if (LK) { var p0 = document.getElementById("fsBrWhy"); if (p0) p0.remove(); return; }
    // the live app keeps the button clickable but refuses quietly, so check the same two things whether or not it is greyed
    var bal = document.getElementById("brBal"), diff = "";
    [].slice.call(document.querySelectorAll("tr")).forEach(function (tr) { if (/^\s*Difference\s*$/i.test((tr.children[0] || {}).textContent || "") && tr.children[1]) diff = String(tr.children[1].textContent || "").trim(); });
    var nil = /^\(?\s*-?0(\.0+)?\s*\)?$/.test(diff.replace(/,/g, "")) || /^[-–—]$/.test(diff);
    var why = !bal || !String(bal.value).trim() ? "Mark reconciled works once you type the closing balance from the bank statement in \"Closing balance per bank statement\" above."
      : diff && !nil ? "Mark reconciled works once the difference is 0 (now " + diff + "). Tick each entry that is on the statement, and draft a voucher for bank charges or profit that are only on the statement." : "";
    var p = document.getElementById("fsBrWhy");
    if (!why) { if (p) p.remove(); return; }
    if (!p) { b.parentNode.insertAdjacentHTML("afterend", "<p class=\"fs-brwhy\" id=\"fsBrWhy\"></p>"); p = document.getElementById("fsBrWhy"); }
    if (p && p.textContent !== why) p.textContent = why;
  }
  // Lock (hassan, 2026-11-21, QuickBooks-style "R" entries): a completed reconciliation cannot be changed; its ticks,
  // statement balance and buttons are frozen, and only an ERP admin can undo it (the server refuses anyone else). A
  // statement dated before one already completed for the same bank cannot be reconciled either, because that would clear
  // entries twice: undo the later one first. Vouchers cleared on a completed reconciliation say so on their form.
  var LK = null;
  var isAdmin = function () { return !!(window.FS_BRIDGE && window.FS_BRIDGE.owner); };
  function lockState() {
    var acc = document.getElementById("brAcc"), to = document.getElementById("brDate");
    if (!acc || !to || !to.value || typeof V === "undefined" || !V) return null;
    var a = (Store.data.accounts || []).find(function (x) { return x.id === acc.value; }); if (!a) return null;
    var R = Store.data.bankrecs || [], id = recId(V.ent, a.code, to.value), rec = R.find(function (r) { return r.id === id; });
    if (rec && rec.status === "Reconciled") return { k: "done", rec: rec, id: id };
    var later = R.filter(function (r) { return r.entity === V.ent && r.account === a.id && r.status === "Reconciled" && String(r.stmtDate) > to.value; })
      .sort(function (x, y) { return String(y.stmtDate).localeCompare(String(x.stmtDate)); })[0];
    return later ? { k: "later", rec: later, id: id } : null;
  }
  function lock() {
    LK = lockState();
    var bar = document.getElementById("fsBrLock"), done = document.getElementById("brDone");
    if (!LK) { if (bar) bar.remove(); return; }
    var by = (LK.rec.preparedBy || {}).name || "", at = String((LK.rec.preparedBy || {}).at || "").slice(0, 10);
    var html = LK.k === "done"
      ? "<b>🔒 Reconciled" + (by ? " by " + esc(by) : "") + (at ? " on " + esc(fd(at)) : "") + ". Locked.</b> The ticked entries, the statement balance and this reconciliation cannot be changed." +
        (isAdmin() ? " <button type=\"button\" class=\"btn sm danger\" id=\"fsBrUndo\">Undo reconciliation</button>" : " Only an ERP admin can undo it.")
      : "<b>🔒 A later statement (" + esc(fd(LK.rec.stmtDate)) + ") is already reconciled for this bank.</b> Reconcile statements in date order: pick a date after " + esc(fd(LK.rec.stmtDate)) + ", or ask an ERP admin to undo that reconciliation first.";
    if (!bar) { var anchor = done ? done.parentNode : document.querySelector(".ctls"); if (!anchor) return; anchor.insertAdjacentHTML("beforebegin", "<div class=\"fs-brlock\" id=\"fsBrLock\"></div>"); bar = document.getElementById("fsBrLock"); }
    if (bar.innerHTML !== html) bar.innerHTML = html;
    document.querySelectorAll("input[data-brk]").forEach(function (cb) { if (!cb.disabled) cb.disabled = true; });
    ["brSave", "brDone", "brAll", "brNone"].forEach(function (i) { var b = document.getElementById(i); if (b && !b.disabled) b.disabled = true; });
    var bal = document.getElementById("brBal"); if (bal && !bal.readOnly) bal.readOnly = true;
  }
  // the app keeps some of its buttons clickable, so stop them here while locked
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (LK && (t.closest("#brSave, #brDone, #brAll, #brNone, #brJv") || (t.matches && t.matches("input[data-brk]")))) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (typeof toast === "function") toast(LK.k === "done" ? "This reconciliation is locked." : "A later statement is already reconciled for this bank.");
      return;
    }
    if (t.id === "fsBrUndo" && LK && LK.k === "done" && isAdmin()) {
      e.preventDefault(); e.stopImmediatePropagation();
      var nm = (typeof approverName === "function" && approverName()) || (window.FS_BRIDGE && window.FS_BRIDGE.name) || "admin";
      t.disabled = true;
      Store.save("bankrecs", Object.assign({}, LK.rec, { status: "Draft", undone: (LK.rec.undone || []).concat([{ name: nm, at: new Date().toISOString() }]) }))
        .then(function () { if (typeof toast === "function") toast("Reconciliation undone. It is a draft again."); LK = null; if (typeof render === "function") render(); },
          function (er) { t.disabled = false; if (typeof toast === "function") toast((er && er.message) || "Could not undo it."); });
    }
  }, true);
  document.addEventListener("keydown", function (e) { if (LK && e.target && e.target.id === "brBal") { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  // on a voucher: the reconciliations that cleared it
  function jvMark() {
    if (typeof F === "undefined" || !F || F.c !== "journals" || !F.rec || !F.rec.id) { var o = document.getElementById("fsJvRec"); if (o) o.remove(); return; }
    var h2 = document.querySelector("#frm h2"); if (!h2) return;
    var pre = F.rec.id + ":", hits = (Store.data.bankrecs || []).filter(function (r) { return r.status === "Reconciled" && (r.cleared || []).some(function (k) { return String(k).indexOf(pre) === 0; }); });
    var cur = document.getElementById("fsJvRec");
    if (!hits.length) { if (cur) cur.remove(); return; }
    var txt = "🔒 Cleared on the bank reconciliation of " + hits.map(function (r) { return fd(r.stmtDate) + " (" + (r.accCode || "") + ")"; }).join(", ") +
      ". It cannot be changed. If it was wrong (e.g. a bounced cheque), post a reversing voucher: the reversal comes onto the next reconciliation.";
    if (cur && cur.textContent === txt) return;
    if (!cur) { h2.insertAdjacentHTML("afterend", "<p class=\"banner info fs-jvrec\" id=\"fsJvRec\"></p>"); cur = document.getElementById("fsJvRec"); }
    cur.textContent = txt;
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
      if (!tr.querySelector("input[data-brk]") || tr.classList.contains("fs-brpair") || tr.classList.contains("fs-bropen") || tr.classList.contains("fs-brearly")) return;
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
      ".fs-brcl{margin-top:14px}.fs-brcl h3{margin:10px 12px}.fs-brcl .num{text-align:right}.fs-brbf td{background:#f8fafc;font-style:italic}" +
      ".fs-brcl tfoot td{font-weight:600;border-top:1px solid #e2e8f0}.fs-brok td{color:#15803d}.fs-brbad td{color:#b91c1c}" +
      ".fs-brhist tr.click{cursor:pointer}.fs-brhist tr.click:hover td{background:#f1f5f9}.fs-brhistx>td{background:#f8fafc;padding:8px 10px}.fs-brhistx table{width:100%;font-size:12.5px}.fs-brhistf{margin-top:8px}.fs-bratt{margin-top:10px}" +
      ".fs-brpick{padding:18px;margin-top:12px;color:#334155;background:#f8fafc}" +
      ".fs-brtabs{display:flex;gap:4px;margin:14px 0 0;border-bottom:2px solid #e2e8f0}.fs-brtabs button{border:0;background:none;padding:9px 16px;font:inherit;font-weight:600;color:#64748b;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px}" +
      ".fs-brtabs button[aria-selected=true]{color:#1F6FB8;border-bottom-color:#1F6FB8}.fs-brtabs span{display:inline-block;min-width:20px;padding:0 6px;margin-left:4px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:12px}" +
      ".fs-brsumc{margin-top:12px}.fs-brsumc h3{margin:0 0 8px}.fs-brsum5{grid-template-columns:repeat(5,1fr)}@media(max-width:900px){.fs-brsum5{grid-template-columns:1fr 1fr}}" +
      ".fs-brlock{margin:10px 0;padding:10px 12px;border:1px solid #93c5fd;border-radius:10px;background:#eff6ff;font-size:13px;color:#1e3a8a}.fs-brlock .btn{margin-left:8px}" +
      ".fs-brwhy{margin:6px 0 0;font-size:12.5px;color:#b45309}" +
      ".fs-bf{font-size:11px;color:#b45309;font-weight:600}" +
      ".fs-brfind{display:flex;align-items:center;gap:8px;margin:8px 0}.fs-brfind label{font-weight:600;font-size:13px}.fs-brfind input{flex:0 1 360px;padding:6px 9px;font:inherit}";
    document.head.appendChild(css);
  }
  start();
})();
