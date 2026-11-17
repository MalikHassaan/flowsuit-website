// Cheques issued: post-dated and security cheques given to vendors (hassan, 2026-11-17: "if we issue a cheque to a
// vendor in advance date how the system knows and tackles that and how the system will manage", with two JS Bank
// cheques to Capital Enterprises dated 27 Dec 2026; "yes build it"). Under Payables › Cheques issued:
//  * One record per cheque: company, bank, cheque no., date on the cheque, pay to, amount, kind (post-dated payment or
//    security / guarantee), what it is against, the payable account it settles, and the scan (attachments).
//  * Nothing is posted when the cheque is given: the bank balance changes only when the money leaves. On or after the
//    cheque date, "Make BPV" creates the bank payment voucher (Dr the payable, Cr the bank, with the cheque no. and
//    date), which goes through approval like every voucher. A security cheque gets the same button for when the
//    vendor deposits it; otherwise it is marked Returned when it comes back.
//  * The list, and Home, show the cheques falling due in the next 30 days against each bank's balance in the books.
//  * A cheque number can be entered once per bank; the server also refuses a second voucher with the same cheque
//    number on the same bank (hsec_dup_cheque).
(function () {
  /* global S, MODS, TAB_HOME, DOCNAME, LABEL, COLLS, Store, F, V, LEDGER, openForm, submitForm, readForm, nextNo, fmt, n,
     esc, fdate, pill, mono, scheduleRender, todayStr, accByCode, approverName, isLocked, lockTxt, jvTot, nextVoucherNo,
     toast, dashboard, liveJv, srcJvs, byEnt */
  var C = "chqissued", KINDS = ["Post-dated payment", "Security (guarantee)"], ST = ["With vendor", "Returned to us", "Cancelled"];
  var D = function (c) { return (typeof Store !== "undefined" && Store.data && Store.data[c]) || []; };
  var byId = function (c, id) { return D(c).find(function (r) { return r.id === id; }) || null; };
  var vouchersOf = function (id) {
    if (typeof srcJvs === "function") return srcJvs(C, id);
    return D("journals").filter(function (j) { return j.source && j.source.c === C && j.source.id === id; });
  };
  var live = function (id) {
    if (typeof liveJv === "function") return liveJv(C, id, "pay");
    return vouchersOf(id).find(function (j) { return j.source.ev === "pay" && j.status !== "Rejected"; });
  };
  var today = function () { return typeof todayStr === "function" ? todayStr() : new Date().toISOString().slice(0, 10); };
  var days = function (d) { return Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5); };
  var accName = function (id) { var a = D("accounts").find(function (x) { return x.id === id; }); return a ? a.code + " " + a.name : ""; };
  var isSec = function (r) { return /^Security/.test(r.kind || ""); };

  // where a cheque stands
  function state(r) {
    var bp = r.id && live(r.id);
    if (bp && bp.status === "Posted") return { k: "paid", l: "Paid", c: "good", bp: bp };
    if (bp) return { k: "payappr", l: "Payment in approval", c: "acc", bp: bp };
    if (r.status === "Returned to us") return { k: "back", l: "Returned to us", c: "" };
    if (r.status === "Cancelled") return { k: "cancel", l: "Cancelled", c: "" };
    var d = r.chequeDate ? days(r.chequeDate) : 9999;
    if (isSec(r)) return d < 0 ? { k: "sec", l: "Security, held by vendor (date passed)", c: "warn", d: d } : { k: "sec", l: "Security, held by vendor", c: "acc", d: d };
    if (d < 0) return { k: "due", l: "Date passed " + (-d) + " day" + (d === -1 ? "" : "s") + " ago: make the BPV", c: "bad", d: d };
    if (d === 0) return { k: "due", l: "Due today: make the BPV", c: "bad", d: d };
    if (d <= 30) return { k: "soon", l: "Due in " + d + " day" + (d === 1 ? "" : "s"), c: "warn", d: d };
    return { k: "out", l: "With vendor", c: "acc", d: d };
  }
  var open = function (r) { var k = state(r).k; return k === "due" || k === "soon" || k === "out" || k === "sec"; };

  // each bank's balance in the books (posted vouchers)
  function bankBal(acc) {
    var b = 0;
    D("journals").forEach(function (j) {
      if (j.status !== "Posted") return;
      (j.lines || []).forEach(function (l) { if (l.account === acc) b += n(l.debit) - n(l.credit); });
    });
    return Math.round(b);
  }
  // the cheques due in the next 30 days (and any past their date), by bank
  function dueSoon() {
    var rows = (typeof byEnt === "function" ? byEnt(D(C).slice()) : D(C).slice()).filter(function (r) {
      var s = state(r); return !isSec(r) && (s.k === "due" || s.k === "soon");
    }).sort(function (a, b) { return String(a.chequeDate).localeCompare(String(b.chequeDate)); });
    var g = {};
    rows.forEach(function (r) { var x = g[r.bank] = g[r.bank] || { n: 0, a: 0, rows: [] }; x.n++; x.a += n(r.amount); x.rows.push(r); });
    return { rows: rows, g: g };
  }
  function alertHtml(home) {
    var x = dueSoon(); if (!x.rows.length) return "";
    var sec = D(C).filter(function (r) { return isSec(r) && state(r).k === "sec"; });
    var bk = Object.keys(x.g);
    return "<div class=\"fs-chqal\"><b>Cheques issued falling due in the next 30 days: " + x.rows.length + ", Rs " + fmt(x.rows.reduce(function (s, r) { return s + n(r.amount); }, 0)) + "</b>" +
      "<div class=\"tw\"><table><thead><tr><th>Bank</th><th class=\"num\">Cheques</th><th class=\"num\">Amount due</th><th class=\"num\">Balance in books</th><th class=\"num\">Short by</th></tr></thead><tbody>" +
      bk.map(function (b) { var y = x.g[b], bal = bankBal(b), sh = y.a - bal; return "<tr><td>" + esc(accName(b) || "No bank") + "</td><td class=\"num\">" + y.n + "</td><td class=\"num\">" + fmt(y.a) + "</td><td class=\"num\">" + fmt(bal) + "</td><td class=\"num\">" + (sh > 0 ? "<b style=\"color:#b91c1c\">" + fmt(sh) + "</b>" : "–") + "</td></tr>"; }).join("") +
      "</tbody></table></div>" +
      "<div class=\"fs-chqnext\">" + x.rows.slice(0, 6).map(function (r) { return esc(fdate(r.chequeDate)) + ": " + esc(r.payee || "") + " Rs " + fmt(r.amount) + " (cheque " + esc(r.chequeNo || "") + ")"; }).join("<br>") + (x.rows.length > 6 ? "<br>…" : "") + "</div>" +
      (sec.length ? "<div class=\"muted\">Also " + sec.length + " security cheque" + (sec.length === 1 ? "" : "s") + " (Rs " + fmt(sec.reduce(function (s, r) { return s + n(r.amount); }, 0)) + ") held by vendors.</div>" : "") +
      (home ? "<a href=\"#e_ap/" + C + "\" class=\"btn sm\" data-chqgo=\"1\">Open Cheques issued</a>" : "") + "</div>";
  }

  function defs() {
    S[C] = { title: "Cheque issued", fields: [
      { k: "chqNo", l: "Register no.", req: 1 }, { k: "entity", l: "Company", t: "entity", req: 1 },
      { k: "bank", l: "Bank account (drawn on)", t: "acc", af: "bank", req: 1 },
      { k: "chequeNo", l: "Cheque no.", req: 1, hint: "As printed on the cheque, e.g. 79756909." },
      { k: "chequeDate", l: "Date on the cheque", t: "date", req: 1, hint: "The date the vendor can deposit it. The bank payment is booked on this date." },
      { k: "issuedOn", l: "Given to the vendor on", t: "date" },
      { k: "payee", l: "Pay to (as written on the cheque)", req: 1 },
      { k: "amount", l: "Amount (PKR)", t: "money", req: 1 },
      { k: "kind", l: "Kind of cheque", t: "select", o: KINDS, req: 1, hint: "Post-dated payment: the bill is owed and is paid on the cheque date. Security: held as a guarantee and normally returned." },
      { k: "against", l: "Against (bill, PO or purpose)", hint: "e.g. Balance payment of PTC, PO-0012, or Security for the Dubai shipment." },
      { k: "payAcc", l: "Payable account (debit when it is paid)", t: "acc", af: "payable", hint: "The vendor's payable, or 220204 Other accrued expenses. Needed to make the BPV." },
      { k: "status", l: "Status", t: "select", o: ST, hint: "Paid is set by the bank payment voucher. Use Returned when a security cheque comes back, Cancelled if it is torn up." },
      { k: "notes", l: "Notes", t: "textarea" }],
      cols: [["chqNo", "No.", function (r) { return mono(r.chqNo || ""); }], ["chequeDate", "Cheque date", function (r) { return fdate(r.chequeDate); }],
        ["entity", "Company"], ["bank", "Bank", function (r) { return esc(accName(r.bank)); }], ["chequeNo", "Cheque no.", function (r) { return mono(r.chequeNo || ""); }],
        ["payee", "Pay to"], ["kind", "Kind", function (r) { return isSec(r) ? "Security" : "Post-dated"; }], ["against", "Against"], ["amount", "Amount", null, "num"],
        ["bp", "Bank payment", function (r) {
          var s = state(r);
          if (s.bp) return mono(s.bp.ref || "") + " " + pill(s.bp.status === "Posted" ? "Posted" : "In approval", s.bp.status === "Posted" ? "good" : "warn");
          if (!open(r)) return "<span class=\"muted\">–</span>";
          return "<button type=\"button\" class=\"btn sm" + (s.k === "due" ? " pri" : "") + "\" data-chqbpv=\"" + esc(r.id) + "\">" + (isSec(r) ? "Deposited: make BPV" : "Make BPV") + "</button>";
        }],
        ["st", "Status", function (r) { var s = state(r); return pill(s.l, s.c); }]],
      sort: function (a, b) { return String(a.chequeDate || "").localeCompare(String(b.chequeDate || "")) || String(a.chqNo || "").localeCompare(String(b.chqNo || "")); } };
    if (typeof DOCNAME !== "undefined") DOCNAME[C] = "cheque issued";
    if (typeof LABEL !== "undefined") LABEL[C] = "chqNo";
    var m = MODS.e_ap;
    if (m && !m.tabs.some(function (t) { return t[0] === C; })) m.tabs.push([C, "Cheques issued (post-dated / security)"]);
    if (typeof TAB_HOME !== "undefined") TAB_HOME[C] = "e_ap";
  }
  function subscribe() {
    if (COLLS.indexOf(C) < 0) COLLS.push(C);
    if (!Array.isArray(Store.data[C])) Store.data[C] = [];
    if (Store.db) Store.db.collection(C).onSnapshot(function (s) {
      Store.data[C] = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      LEDGER = null; scheduleRender(); // eslint-disable-line no-global-assign
    });
  }

  // the bank payment voucher for a cheque, sent for approval
  async function makeBpv(r) {
    if (live(r.id)) throw new Error("this cheque already has a bank payment voucher");
    if (!r.payAcc) throw new Error("choose the payable account on the cheque first (open it, set Payable account, save)");
    if (!r.bank) throw new Error("choose the bank account on the cheque first");
    var a = Math.round(n(r.amount)); if (!(a > 0)) throw new Error("the cheque has no amount");
    var dup = D("journals").find(function (j) {
      return j.status !== "Rejected" && !j.reversalOf && !j.reversedBy && String(j.chequeNo || "").trim() === String(r.chequeNo || "").trim() && j.entity === r.entity &&
        (j.lines || []).some(function (l) { return l.account === r.bank && n(l.credit) > 0; });
    });
    if (dup) throw new Error("cheque " + r.chequeNo + " is already in voucher " + (dup.ref || "") + ". Do not pay it twice");
    var name = (typeof approverName === "function" && approverName()) || "ERP user", now = new Date().toISOString();
    var j = { vtype: "Bank payment voucher", date: r.chequeDate || today(), entity: r.entity, payee: r.payee || "", chequeNo: r.chequeNo || "", chequeDate: r.chequeDate || "",
      dept: "Finance & Accounts", opening: "No", status: "Pending approval", source: { c: C, id: r.id, ev: "pay", key: "pay" }, maker: { name: name, at: now }, approvals: [],
      narration: (isSec(r) ? "Security cheque deposited by " : "Post-dated cheque to ") + (r.payee || "") + ", cheque " + (r.chequeNo || "") + " dated " + fdate(r.chequeDate) + (r.against ? ": " + r.against : ""),
      lines: [{ account: r.payAcc, debit: a, credit: 0, desc: (r.payee || "") + (r.against ? " – " + r.against : "") }, { account: r.bank, debit: 0, credit: a, desc: "Cheque " + (r.chequeNo || "") }] };
    if (typeof isLocked === "function" && isLocked(j)) throw new Error(j.entity + " " + lockTxt(j.entity) + ". Change the cheque date or open the period");
    if (typeof jvTot === "function" && !jvTot(j).ok) throw new Error("the voucher would not balance");
    j.ref = nextVoucherNo(j); j.id = await Store.save("journals", j);
    return j;
  }

  function err(m) { var e = document.getElementById("ferr"); if (e) e.textContent = m; return false; }
  function check() {
    var r = F.rec, no = String(r.chequeNo || "").replace(/\s+/g, "");
    r.chequeNo = no;
    if (!/^[A-Za-z0-9-]{3,20}$/.test(no)) return err("Enter the cheque number as printed on the cheque.");
    if (!(n(r.amount) > 0)) return err("Enter the amount.");
    var other = D(C).find(function (x) { return x.id !== r.id && x.bank === r.bank && String(x.chequeNo || "") === no && x.status !== "Cancelled"; });
    if (other) return err("Cheque " + no + " on this bank is already entered as " + (other.chqNo || "another cheque") + ".");
    var was = r.id && byId(C, r.id), bp = r.id && live(r.id);
    if (was && bp && ["amount", "bank", "chequeNo", "entity", "payAcc"].some(function (k) { return String(was[k] || "") !== String(r[k] || ""); }))
      return err("This cheque already has voucher " + (bp.ref || "") + ", so its amount, bank, number, company and payable account cannot change. Reject or reverse that voucher first.");
    if (!r.status) r.status = "With vendor";
    return true;
  }

  function hook() {
    if (typeof S === "undefined" || !S.payables || typeof MODS === "undefined" || !MODS.e_ap || typeof Store === "undefined" || !Store.ready ||
      typeof submitForm !== "function" || typeof openForm !== "function" || typeof readForm !== "function" || typeof nextVoucherNo !== "function") return false;
    defs();
    subscribe();

    openForm = (function (old) { // eslint-disable-line no-global-assign
      return function (c, id, pre) {
        if (c === C && !id) {
          var ent = V && V.ent && V.ent !== "All" ? V.ent : "";
          pre = Object.assign({ chqNo: nextNo(C, "chqNo", "CHQ-"), kind: KINDS[0], status: "With vendor", issuedOn: today(), payAcc: (accByCode()["220204"] || {}).id || "" }, ent ? { entity: ent } : {}, pre || {});
        }
        return old.call(this, c, id, pre);
      };
    })(openForm);
    submitForm = (function (old) { // eslint-disable-line no-global-assign
      return async function () {
        if (!F || F.c !== C) return old.apply(this, arguments);
        readForm(); if (check() !== true) return false;
        var save = Store.save, why = null;
        Store.save = function () { return save.apply(this, arguments).catch(function (e) { why = e; throw e; }); };
        try {
          var ok = await old.apply(this, arguments);
          if (ok === false && why) err("Could not save: " + (why.message || why.code || why) + ".");
          return ok;
        } finally { Store.save = save; }
      };
    })(submitForm);

    // Home: the cheques falling due, before the rest of the page
    if (typeof dashboard === "function") dashboard = (function (old) { // eslint-disable-line no-global-assign
      return function () { var h = old.apply(this, arguments); try { return typeof h === "string" ? alertHtml(true) + h : h; } catch (e) { return h; } };
    })(dashboard);
    // the register: the same alert above the list
    new MutationObserver(function () {
      if (!new RegExp("/" + C + "$").test(location.hash) || document.querySelector(".fs-chqtop")) return;
      var q = document.querySelector("#q"), bar = q && q.closest(".bar"); if (!bar) return;
      bar.insertAdjacentHTML("beforebegin", "<div class=\"fs-chqtop\">" + (alertHtml(false) || "<p class=\"muted\" style=\"margin:0 0 10px\">No cheques fall due in the next 30 days. Enter every post-dated or security cheque here when it is given to a vendor; nothing is posted until it is paid.</p>") + "</div>");
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", function (e) {
      var go = e.target.closest && e.target.closest("[data-chqgo]");
      if (go) { e.preventDefault(); location.hash = "#e_ap/" + C; return; }
      var b = e.target.closest && e.target.closest("[data-chqbpv]"); if (!b) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var r = byId(C, b.getAttribute("data-chqbpv")); if (!r) return;
      if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to make BPV of Rs " + fmt(r.amount); setTimeout(function () { if (b.isConnected) { delete b.dataset.sure; b.textContent = isSec(r) ? "Deposited: make BPV" : "Make BPV"; } }, 6000); return; }
      b.disabled = true;
      makeBpv(r).then(function (j) { toast(j.ref + " for cheque " + r.chequeNo + " sent for approval."); scheduleRender(); },
        function (x) { b.disabled = false; delete b.dataset.sure; b.textContent = isSec(r) ? "Deposited: make BPV" : "Make BPV"; toast("Not made: " + ((x && x.message) || x) + "."); });
    }, true);

    var css = document.createElement("style");
    css.textContent = ".fs-chqal{margin:0 0 14px;padding:12px 14px;border:1px solid #f59e0b;border-left:5px solid #d97706;border-radius:10px;background:#fffbeb;font-size:13px}" +
      ".fs-chqal table{margin:8px 0;background:#fff}.fs-chqnext{margin:6px 0;line-height:1.5}.fs-chqal .btn{margin-top:6px}";
    document.head.appendChild(css);
    scheduleRender();
    return true;
  }
  var tries = 0;
  function start() {
    var ok = false;
    try { ok = hook(); } catch (e) { console.error("Cheques issued could not start", e); return; }
    if (!ok && ++tries < 400) setTimeout(start, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
