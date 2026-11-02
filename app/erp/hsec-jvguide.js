// Posting guide on the voucher form (hassan, 2026-11-02: "while making entry give suggestions how to post the entry, in
// the whole ERP"). Shown under the lines of every journal / bank / cash voucher being entered:
//  * "What are you recording?": the usual debit and credit for common entries, with the account groups to pick from;
//  * "This entry reads": each line in plain words (money leaves JPL's bank, JSPL owes JPL more, a cost is recorded ...);
//  * checks that flag the usual mistakes before saving: another company's bank or account in this company's voucher,
//    the same account on both sides, a group-company line without "On behalf of", an expense credited, a bank line
//    without a cheque / TT number, a project cost without a cost centre, a voucher type that does not match the lines.
// Advice only: nothing is changed or blocked. Runs in the browser; no figures leave the page.
(function () {
  /* global F, Store, ENTS, coName, esc, fmt, n, readLines, isPost */
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var num = function (v) { return safe(function () { return n(v); }, parseFloat(String(v || "").replace(/,/g, "")) || 0); };
  var money = function (v) { return safe(function () { return fmt(v); }, String(v)); };
  var co = function (e) { return safe(function () { return coName(e) || e; }, e); };
  var val = function (k) { var el = document.getElementById("f_" + k); return el ? String(el.value || "").trim() : String((F && F.rec && F.rec[k]) || "").trim(); };
  var acc = function (id) { return safe(function () { return Store.data.accounts.find(function (a) { return a.id === id; }); }, null); };
  var code = function (a) { return String(a && a.code || ""); };
  var kindOf = function (a) {
    if (!a) return "";
    var c = code(a);
    if (a.ic === "Yes" || /^1207|^2204/.test(c)) return /^2/.test(c) ? "icp" : "icr";
    if (a.fsLine === "cash" || /^1210/.test(c)) return "cash";
    if (/^2208/.test(c)) return "od";
    if (/^2201/.test(c)) return "sup";
    if (/^2203/.test(c)) return "stat";
    if (/^2202|^2212/.test(c)) return "accr";
    if (a.fsLine === "td") return "cust";
    if (a.fsLine === "cl") return "custadv";
    if (/^1204/.test(c)) return "adv";
    if (a.fsLine === "cor") return "cor";
    if (a.type === "Expense") return "exp";
    if (a.type === "Income") return "inc";
    if (a.type === "Asset") return "asset";
    if (a.type === "Liability") return "liab";
    if (a.type === "Equity") return "eq";
    return "";
  };

  // ---- common entries
  var RECIPES = [
    ["", "Choose one to see how it is posted…"],
    ["xfer", "Transfer between two banks of this company", "Dr the bank that RECEIVED the money (1210)", "Cr the bank the money LEFT (1210)",
      "Both banks must belong to this company. Put the TT / cheque no. under More details. Nothing is income or expense."],
    ["icout", "Money sent to (or paid for) another group company", "Dr Due from that company (1207)", "Cr this company's bank (1210)",
      "Set On behalf of to the other company. In “Charge in their books to” pick THEIR bank if the money reached their bank, or their expense / supplier if you paid their bill. Their voucher (Dr that account, Cr Due to this company) is made for you."],
    ["icin", "Money received from (or for) another group company", "Dr this company's bank (1210)", "Cr Due to that company (2204)",
      "Set On behalf of to the other company and, in “Charge in their books to”, the account it came out of there."],
    ["loangive", "Loan given to another group company", "Dr Loan to / Due from that company (1207)", "Cr this company's bank (1210)",
      "Set On behalf of to the borrower and “Charge in their books to” their bank. Their voucher: Dr their bank, Cr Due to this company (2204). Keep loans apart from day-to-day balances by opening a sub account under 1207 named “Loan to <company>” (and under 2204 “Loan from <company>” in theirs); their voucher then uses that loan account by itself."],
    ["loantake", "Loan received from another group company", "Dr this company's bank (1210)", "Cr Loan from / Due to that company (2204)",
      "Set On behalf of to the lender and “Charge in their books to” the bank it came out of there. Their voucher: Dr Due from this company (1207), Cr their bank."],
    ["loanrepay", "Repay a loan to a group company", "Dr Loan from / Due to that company (2204)", "Cr this company's bank (1210)",
      "Set On behalf of to the lender. Their voucher: Dr their bank, Cr Due from this company (1207)."],
    ["loanback", "Group company repays a loan to this company", "Dr this company's bank (1210)", "Cr Loan to / Due from that company (1207)",
      "Set On behalf of to the borrower. Their voucher: Dr Due to this company (2204), Cr their bank."],
    ["loanint", "Mark-up / interest charged on a group loan", "Lender: Dr Due from that company (1207)", "Lender: Cr Income from financial assets (7101)",
      "Enter it in the lender's books with On behalf of the borrower and “Charge in their books to” Mark-up on borrowings (8101): the borrower gets Dr 8101, Cr Due to the lender (2204). If no mark-up is charged, post nothing."],
    ["bankloan", "Loan from a bank or outside lender", "Dr bank (1210)", "Cr Long-term financing (2101) or Short-term borrowings (2208)",
      "Repayment: Dr the same loan account, Cr bank. Mark-up paid: Dr Mark-up on borrowings (8101), Cr bank (or Cr Accrued mark-up 2207 if not paid yet). The part due within 12 months moves to 2209 at year end."],
    ["supplier", "Pay a supplier's bill", "Dr the supplier's payable (2201)", "Cr bank (1210); tax withheld: Cr Statutory dues (2203)",
      "Easier from Payables › Vendor bills › Pay, which settles the bill. Advance before a bill: Dr Advances to suppliers (1204)."],
    ["expense", "Pay an expense directly (no bill booked)", "Dr the expense head: 5101–5104 project costs, 6101–6108 office, 8103 bank charges", "Cr bank or cash (1210)",
      "Project cost? Use a 51xx head and set Cost centre to the project. Tax withheld from the payee: Cr Statutory dues (2203) and pay the net."],
    ["accrual", "Expense incurred, to be paid later", "Dr the expense head (5xxx / 6xxx)", "Cr Accrued and other liabilities (2202) or the supplier (2201)",
      "When paid later: Dr the same liability, Cr bank."],
    ["customer", "Receive money from a customer against an invoice", "Dr bank (1210)", "Cr Trade debts (1203)",
      "Easier from Receivables › Receive payments, which marks the invoice paid. Tax deducted by the customer: Dr Taxation – net (1209)."],
    ["custadv", "Advance received from a customer (before invoicing)", "Dr bank (1210)", "Cr Contract liabilities (2206 / 220601)",
      "It is not income yet; it is cleared against the invoices later. Easier from Receivables › Customer advances."],
    ["empadv", "Advance or loan to an employee", "Dr Advances to employees (120403)", "Cr bank or cash (1210)",
      "Recovered from salary later: Dr Staff costs payable / salary, Cr 120403."],
    ["salary", "Salaries", "Dr Staff costs (6101; project staff 5102)", "Cr bank (1210); tax deducted: Cr Statutory dues (2203)",
      "Booked before payment: Cr Accrued liabilities (2202) instead of bank, then pay it."],
    ["charges", "Bank charges, commission, mark-up", "Dr Bank charges (8103) or Mark-up (8101)", "Cr the bank (1210)", "Date it as on the bank statement."],
    ["petty", "Top up petty cash", "Dr the petty cash account (1210)", "Cr bank (1210)", "Better from Treasury › Petty cash so the fund balance stays right."],
    ["fix", "Correct a posted voucher", "—", "—", "Do not post a hand-made opposite entry. Open the posted voucher and use “Reverse and correct”, which keeps the audit trail."]
  ];
  var chosen = {};

  // ---- plain words for each line
  function says(l, a, ent) {
    var dr = num(l.debit) > 0, amt = money(dr ? l.debit : l.credit), k = kindOf(a), nm = a ? code(a) + " " + a.name : "(no account)";
    var other = otherCo(a, ent);
    var t = {
      cash: dr ? "money comes INTO " + nm : "money goes OUT of " + nm,
      od: dr ? "the overdraft / borrowing is reduced" : "more is drawn on the borrowing",
      icr: dr ? (other ? co(other) + " owes " + co(ent) + " more" : "the group company owes more") : (other ? co(other) + " paid back / owes less" : "the group company owes less"),
      icp: dr ? (other ? co(ent) + " owes " + co(other) + " less" : "less is owed to the group company") : (other ? co(ent) + " owes " + co(other) + " more" : "more is owed to the group company"),
      sup: dr ? "the supplier is owed less (paid or debit note)" : "the supplier is owed more (bill booked)",
      stat: dr ? "tax / statutory dues paid over" : "tax / statutory dues payable recorded",
      accr: dr ? "an accrued liability is settled" : "a liability is recorded, to be paid later",
      cust: dr ? "the customer owes more (invoice)" : "the customer paid / owes less",
      custadv: dr ? "the customer advance is used up" : "an advance from the customer is held",
      adv: dr ? "an advance is given" : "an advance is recovered or adjusted",
      cor: dr ? "a project / direct cost is recorded" : "a project cost is REDUCED",
      exp: dr ? "an expense is recorded" : "an expense is REDUCED",
      inc: dr ? "income is REDUCED" : "income is earned",
      asset: dr ? "the asset goes up" : "the asset goes down",
      liab: dr ? "the liability goes down" : "the liability goes up",
      eq: dr ? "equity goes down" : "equity goes up"
    }[k] || (dr ? "debit" : "credit");
    return "<li><b>" + (dr ? "Dr" : "Cr") + " " + h(nm) + " " + h(amt) + "</b>: " + h(t) + "</li>";
  }
  function otherCo(a, ent) {
    if (!a) return "";
    var ents = safe(function () { return ENTS(); }, []) || [];
    if (a.entity && a.entity !== ent) return a.entity;
    var txt = " " + String(a.name || "").toLowerCase() + " ";
    var hit = ents.filter(function (e) { return e !== ent; }).filter(function (e) {
      var w = new RegExp("[^a-z0-9]" + String(e).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^a-z0-9]");
      var nm = String(co(e) || "").toLowerCase();
      return w.test(txt) || (nm && nm !== String(e).toLowerCase() && nm.length > 4 && txt.indexOf(nm) >= 0);
    });
    // the longest code wins, so "JSPL" is not read as "JPL"
    hit.sort(function (x, y) { return String(y).length - String(x).length; });
    return hit[0] || "";
  }

  // ---- checks
  function checks(L, ent) {
    var out = [], vt = val("vtype"), icFor = val("icFor"), chg = val("icCharge"), cc = val("costCentre"), chq = val("chequeNo"), nar = val("narration").toLowerCase();
    var cash = L.filter(function (x) { return x.k === "cash"; }), drCash = cash.some(function (x) { return x.dr; }), crCash = cash.some(function (x) { return !x.dr; });
    var add = function (lvl, t) { out.push([lvl, t]); };
    L.forEach(function (x) {
      if (!x.a) return;
      var oc = otherCo(x.a, ent);
      if (oc && x.k !== "icr" && x.k !== "icp") add("bad", code(x.a) + " " + x.a.name + " looks like " + co(oc) + "'s account, but this voucher is in " + co(ent) + "'s books. Use " + co(ent) + "'s own account here" + (x.k === "cash" ? " (the bank the money actually moved in for " + co(ent) + ")" : "") + "; " + co(oc) + "'s side goes in “Charge in their books to” with On behalf of.");
      if (x.k === "icr" || x.k === "icp") {
        var own = otherCo(x.a, ent);
        if (icFor && own && own !== icFor) add("bad", code(x.a) + " is the account for " + co(own) + ", but On behalf of says " + co(icFor) + ".");
      }
    });
    var ids = {}; L.forEach(function (x) { if (!x.a) return; ids[x.a.id] = (ids[x.a.id] || "") + (x.dr ? "D" : "C"); });
    Object.keys(ids).forEach(function (id) { if (/D/.test(ids[id]) && /C/.test(ids[id])) { var a = acc(id); add("bad", code(a) + " " + (a && a.name) + " is on both the debit and the credit side, so it cancels out. One of the two lines needs a different account."); } });
    var ic = L.filter(function (x) { return x.k === "icr" || x.k === "icp"; });
    if (ic.length && !icFor) add("warn", "A group-company line (Due from / Due to) is used but On behalf of is empty. Set it, so the other company gets its matching voucher; otherwise only " + co(ent) + "'s side is booked.");
    if (icFor && !ic.length) add("warn", "On behalf of " + co(icFor) + " is set, but no line uses a Due from / Due to " + co(icFor) + " account (1207 / 2204). Paid for them: Dr Due from " + co(icFor) + ". Received for them: Cr Due to " + co(icFor) + ".");
    if (icFor && chg) {
      if (L.some(function (x) { return x.a && x.a.id === chg; })) add("bad", "“Charge in their books to” is the same account as one of your lines. Your lines are " + co(ent) + "'s accounts; the charge account is " + co(icFor) + "'s.");
      var ca = acc(chg), cown = ca && otherCo(ca, icFor);
      if (ca && cown === ent) add("bad", "“Charge in their books to” (" + code(ca) + " " + ca.name + ") looks like " + co(ent) + "'s account. Pick " + co(icFor) + "'s own bank, expense or supplier.");
    }
    if (icFor && !chg) add("warn", "Pick “Charge in their books to”: " + co(icFor) + "'s bank if the money reached their bank, or their expense / supplier if you paid for them.");
    if (/payment/i.test(vt) && !crCash) add("warn", "A payment voucher normally credits a bank or cash account (money going out). None of the credit lines is a bank or cash account.");
    if (/receipt/i.test(vt) && !drCash) add("warn", "A receipt voucher normally debits a bank or cash account (money coming in). None of the debit lines is a bank or cash account.");
    if (/journal/i.test(vt) && cash.length && !(drCash && crCash) && !ic.length) add("tip", "Money moves through a bank here. A " + (crCash ? "Bank payment" : "Bank receipt") + " voucher type keeps bank vouchers in their own numbering and on the bank reconciliation.");
    if (cash.length && !chq) add("tip", "Add the cheque / TT / online transaction no. under More details. Bank reconciliation matches on it.");
    L.forEach(function (x) {
      if (x.a && (x.k === "exp" || x.k === "cor") && !x.dr) add("warn", "Credit on " + code(x.a) + " " + x.a.name + " reduces that expense. Right only for a refund, recovery or correction; to pay an expense, debit the expense and credit the bank.");
      if (x.a && x.k === "inc" && x.dr) add("warn", "Debit on " + code(x.a) + " " + x.a.name + " reduces income. Right only for a discount, credit note or correction.");
    });
    if (L.some(function (x) { return x.k === "cor" && x.dr; }) && !cc && !L.some(function (x) { return x.l.costCentre || x.l.project; })) add("tip", "A project cost (51xx) is debited. Set Cost centre (project) so it shows in that project's profitability.");
    if (/\bpaid\b|payment/.test(nar) && cash.length && !crCash) add("tip", "The description says paid, but no bank or cash line is credited.");
    if (/\breceived\b/.test(nar) && cash.length && !drCash) add("tip", "The description says received, but no bank or cash line is debited.");
    return out;
  }

  function guess(L, icFor) {
    var has = function (k, dr) { return L.some(function (x) { return x.k === k && (dr === undefined || x.dr === dr); }); };
    if (icFor || has("icr") || has("icp")) {
      var loan = L.some(function (x) { return (x.k === "icr" || x.k === "icp") && /loan/i.test(x.a.name || ""); });
      if (loan) return has("icr", true) && has("cash", false) ? "loangive" : has("icp", false) && has("cash", true) ? "loantake" : has("icp", true) ? "loanrepay" : has("icr", false) ? "loanback" : "";
      if (has("inc", false) && has("icr", true)) return "loanint";
      return has("icr", true) ? "icout" : has("icp", false) ? "icin" : "";
    }
    if (has("cash", true) && (has("od", false) || L.some(function (x) { return !x.dr && /^2101|^2209/.test(code(x.a)); }))) return "bankloan";
    if (has("cash", true) && has("cash", false) && L.every(function (x) { return x.k === "cash"; })) return "xfer";
    if (has("sup", true) && has("cash", false)) return "supplier";
    if ((has("exp", true) || has("cor", true)) && has("cash", false)) return "expense";
    if ((has("exp", true) || has("cor", true)) && (has("accr", false) || has("sup", false))) return "accrual";
    if (has("cash", true) && has("cust", false)) return "customer";
    if (has("cash", true) && has("custadv", false)) return "custadv";
    if (has("adv", true) && has("cash", false)) return "empadv";
    return "";
  }

  function html() {
    safe(readLines, null);
    var ent = val("entity") || (F.rec && F.rec.entity) || safe(function () { return V.ent !== "All" ? V.ent : ""; }, "") || ""; // eslint-disable-line no-undef
    var L = (F.lines || []).filter(function (l) { return l && l.account && (num(l.debit) || num(l.credit)); })
      .map(function (l) { var a = acc(l.account); return { l: l, a: a, k: kindOf(a), dr: num(l.debit) > 0 }; });
    var key = (F.rec && F.rec.id) || "new", g = guess(L, val("icFor")), pick = chosen[key] != null ? chosen[key] : g;
    var r = RECIPES.find(function (x) { return x[0] === pick; });
    var C = L.length ? checks(L, ent) : [];
    var icon = { bad: "✖", warn: "!", tip: "i" };
    return "<div class=\"fs-gd-h\"><b>Posting guide</b><span class=\"muted\"> Suggestions only, nothing is changed for you.</span></div>" +
      "<label class=\"fs-gd-pick\"><span>What are you recording?</span><select id=\"fsGdKind\">" + RECIPES.map(function (x) { return "<option value=\"" + x[0] + "\"" + (x[0] === pick ? " selected" : "") + ">" + h(x[1]) + "</option>"; }).join("") + "</select></label>" +
      (r && r[0] ? "<div class=\"fs-gd-rec\"><div><span class=\"fs-gd-dr\">Debit</span>" + h(r[2].replace(/^Dr /, "")) + "</div><div><span class=\"fs-gd-cr\">Credit</span>" + h(r[3].replace(/^Cr /, "")) + "</div><p>" + h(r[4]) + "</p>" + (pick === g && chosen[key] == null ? "<p class=\"muted\" style=\"margin:0\">Picked from the lines you entered; change it if that's not what this is.</p>" : "") + "</div>" : "") +
      (L.length ? "<div class=\"fs-gd-says\"><b>This entry reads</b><ul>" + L.map(function (x) { return says(x.l, x.a, ent); }).join("") + "</ul></div>" : "") +
      (C.length ? "<ul class=\"fs-gd-chk\">" + C.map(function (c) { return "<li class=\"" + c[0] + "\"><i>" + icon[c[0]] + "</i>" + h(c[1]) + "</li>"; }).join("") + "</ul>"
        : L.length >= 2 ? "<p class=\"fs-gd-ok\">✓ No posting problems spotted.</p>" : "");
  }

  var last = "", tmr = 0;
  function draw() {
    tmr = 0;
    if (typeof F === "undefined" || !F || F.c !== "journals" || !F.rec) return;
    var box = document.getElementById("linesBox"); if (!box) return;
    var g = document.getElementById("fsGuide");
    if (!g || g.previousElementSibling !== box) { if (g) g.remove(); g = document.createElement("div"); g.id = "fsGuide"; g.className = "f w fs-guide"; box.insertAdjacentElement("afterend", g); last = ""; }
    var out = safe(html, ""); if (out !== last) { last = out; g.innerHTML = out; }
  }
  var soon = function () { if (!tmr) tmr = setTimeout(draw, 250); };
  document.addEventListener("input", function (e) { if (e.target && e.target.closest && e.target.closest("#frm")) soon(); }, true);
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "fsGdKind") { chosen[(F && F.rec && F.rec.id) || "new"] = e.target.value; last = ""; return draw(); }
    if (e.target && e.target.closest && e.target.closest("#frm")) soon();
  }, true);
  document.addEventListener("click", function (e) { if (e.target && e.target.closest && e.target.closest("#frm")) soon(); }, true);
  function start() {
    if (typeof Store === "undefined" || !Store.data || typeof readLines !== "function") return setTimeout(start, 400);
    new MutationObserver(function () { if (!document.getElementById("fsGuide") && document.getElementById("linesBox")) soon(); }).observe(document.body, { childList: true, subtree: true });
    var css = document.createElement("style");
    css.textContent = ".fs-guide{margin-top:12px;border:1px solid #cfe0f1;background:#f6faff;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5}" +
      ".fs-gd-h{margin-bottom:8px}.fs-gd-pick{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.fs-gd-pick span{font-weight:600}.fs-gd-pick select{max-width:440px;flex:1}" +
      ".fs-gd-rec{margin-top:8px;background:#fff;border:1px solid #e3e8ee;border-radius:8px;padding:8px 10px}.fs-gd-rec p{margin:6px 0 0}" +
      ".fs-gd-dr,.fs-gd-cr{display:inline-block;min-width:52px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em}.fs-gd-dr{color:#1f6fb8}.fs-gd-cr{color:#b0412e}" +
      ".fs-gd-says{margin-top:10px}.fs-gd-says ul{margin:4px 0 0;padding-left:18px}.fs-gd-chk{list-style:none;margin:10px 0 0;padding:0}" +
      ".fs-gd-chk li{display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-radius:6px;margin-top:4px}.fs-gd-chk i{font-style:normal;font-weight:700;width:18px;height:18px;flex:none;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#fff}" +
      ".fs-gd-chk .bad{background:#fdecea}.fs-gd-chk .bad i{background:#c62828}.fs-gd-chk .warn{background:#fff6e0}.fs-gd-chk .warn i{background:#d08a00}.fs-gd-chk .tip{background:#eef4fb}.fs-gd-chk .tip i{background:#1f6fb8}" +
      ".fs-gd-ok{margin:10px 0 0;color:#1b7a3d;font-weight:600}@media print{.fs-guide{display:none}}";
    document.head.appendChild(css);
    soon();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
