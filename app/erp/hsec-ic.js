// One company pays (or receives) on behalf of another group company (hassan, 2026-10-27).
// On the payer's voucher, "On behalf of" names the other company and "Charge in their books to" the account it
// belongs to there. The payer's voucher carries a line on the intercompany account (Due from / Due to that company);
// saving it creates the matching voucher in the other company: Dr that account, Cr Due to the payer (or the reverse
// for a receipt). The matching voucher follows the payer's: it posts when the payer posts, is updated while neither
// is posted, and is reversed when the payer is reversed. General ledger > Intercompany then nets to zero.
(function () {
  /* global S, F, Store, esc, coLabel, fmt, jvSheet, ENTS, coLabel, coName, isPost, readLines, redrawLines, nextVoucherNo, isLocked, lockTxt, toast, approverName, n, DOCNAME */
  var busy = {};

  function accs() { return Store.data.accounts.filter(function (a) { return a.ic === "Yes" && isPost(a); }); }
  // The intercompany account in company `own`'s books for its balance with company `other`: prefix 1207 (due from) or 2204 (due to).
  function icAcc(prefix, other, own) {
    var list = accs().filter(function (a) { return String(a.code).indexOf(prefix) === 0 && (!a.entity || a.entity === own); });
    var i = ENTS().indexOf(other), word = function (s) { return new RegExp("(^|[^A-Za-z0-9])" + String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^A-Za-z0-9]|$)", "i"); };
    return list.find(function (a) { return word(other).test(a.name); })
      || list.find(function (a) { return coName(other) !== other && a.name.toLowerCase().indexOf(coName(other).toLowerCase()) >= 0; })
      || (i >= 0 && list.find(function (a) { return word("ENT" + (i + 1)).test(a.name) || String(a.code) === prefix + String(i + 1).padStart(2, "0"); }))
      || null;
  }
  // Net debit on the payer's intercompany lines: positive = paid for them, negative = received for them.
  function icNet(lines) {
    var ic = {}; accs().forEach(function (a) { ic[a.id] = 1; });
    return (lines || []).reduce(function (s, l) { return ic[l.account] ? s + n(l.debit) - n(l.credit) : s; }, 0);
  }
  function mirrorOf(id) { return Store.data.journals.find(function (j) { return j.icOf === id && !j.reversalOf; }); }
  // The other company's voucher for this one: the matching voucher for a payer, the payer for a matching voucher.
  function other(j) { return !j || !j.id ? null : j.icOf ? Store.data.journals.find(function (x) { return x.id === j.icOf; }) : mirrorOf(j.id); }
  // Both entries side by side: shown on the voucher form and printed on the voucher.
  function sideHtml(j) {
    var o = other(j);
    if (!o) return "";
    var A = {}; Store.data.accounts.forEach(function (a) { A[a.id] = a; });
    var row = function (l) { var a = A[l.account] || {}; return "<tr><td>" + esc((a.code || "") + " " + (a.name || "(account missing)")) + "</td><td class=\"num\">" + (n(l.debit) ? fmt(l.debit) : "") + "</td><td class=\"num\">" + (n(l.credit) ? fmt(l.credit) : "") + "</td></tr>"; };
    var tot = (o.lines || []).reduce(function (s, l) { return s + n(l.debit); }, 0);
    return "<div class=\"fs-icside\"><h4 style=\"margin:14px 0 6px\">Other company's entry: " + esc(coName(o.entity)) + " · " + esc(o.ref || "(not numbered yet)") + " · " + esc(o.status || "Draft") + "</h4>"
      + "<p class=\"muted\" style=\"margin:0 0 6px\">" + esc(j.icOf ? "This voucher records the other company's payment or receipt for us." : "Made automatically in " + coName(o.entity) + "'s books from this voucher.") + "</p>"
      + "<table class=\"vl\" style=\"width:100%\"><thead><tr><th>Account</th><th class=\"num\">Debit</th><th class=\"num\">Credit</th></tr></thead><tbody>"
      + (o.lines || []).map(row).join("") + "<tr class=\"tot\"><td class=\"num\">Total</td><td class=\"num\">" + fmt(tot) + "</td><td class=\"num\">" + fmt(tot) + "</td></tr></tbody></table></div>";
  }

  function addFields() {
    var f = S.journals.fields;
    if (f.some(function (x) { return x.k === "icFor"; })) return;
    var on = { k: "icFor", l: "On behalf of (group company)", t: "select", hint: "Paying or receiving for another group company? Pick it, and the matching voucher is made in its books when you save." };
    Object.defineProperty(on, "o", { enumerable: true, get: function () {
      var own = F && F.rec ? F.rec.entity : "";
      return [["", "No, our own"]].concat(ENTS().filter(function (e) { return e !== own; }).map(function (e) { return [e, coLabel(e)]; }));
    } });
    var at = f.findIndex(function (x) { return x.k === "payee"; });
    f.splice(at < 0 ? f.length : at + 1, 0, on,
      { k: "icCharge", l: "Charge in their books to", t: "acc", hint: "The expense, supplier or other account in the other company that this payment is for." });
    DOCNAME.journals = "a group company's voucher";
  }

  // On the form: the charge account shows only with a company picked; picking one puts its intercompany account on a line.
  function trim() {
    var sel = document.getElementById("f_icFor");
    if (!sel || !F || F.c !== "journals") return;
    var mine = F.rec.source || F.rec.icOf || F.rec.reversalOf;
    var box = sel.closest(".f"), chg = document.getElementById("f_icCharge"), cbox = chg && chg.closest(".f");
    if (box && box.hidden !== !!mine) box.hidden = !!mine;
    if (cbox) { var on = !mine && !!sel.value; if (cbox.hidden === on) cbox.hidden = !on; }
    var bn = F.rec.icOf && document.querySelector("#frm .banner.info");
    if (bn && bn.textContent.indexOf("voucher .") >= 0) {
      var pay = Store.data.journals.find(function (j) { return j.id === F.rec.icOf; }) || {};
      bn.textContent = bn.textContent.replace("voucher .", "voucher " + (pay.ref || "") + " (" + coName(pay.entity || "") + ").");
    }
    var lb = document.getElementById("linesBox"), side = document.getElementById("fsIcSide"), h = sideHtml(F.rec);
    if (lb && h && (!side || side.dataset.h !== h)) {
      if (!side) { side = document.createElement("div"); side.id = "fsIcSide"; lb.after(side); }
      side.dataset.h = h; side.innerHTML = h;
    } else if (side && !h) side.remove();
    if (sel.dataset.fsIc) return;
    sel.dataset.fsIc = "1";
    sel.addEventListener("change", function () {
      trim();
      if (!sel.value) return;
      readLines();
      var own = F.rec.entity, recv = /receipt/i.test((document.getElementById("f_vtype") || {}).value || "");
      var a = icAcc(recv ? "2204" : "1207", sel.value, own);
      if (!a || icNet(F.lines) || F.lines.some(function (l) { return l.account === a.id; })) return;
      var i = F.lines.findIndex(function (l) { return !l.account && !l.main; });
      if (i < 0) { F.lines.push({ main: "", account: "", debit: "", credit: "" }); i = F.lines.length - 1; }
      F.lines[i].main = a.parent;
      F.lines[i].account = a.id;
      redrawLines("l_" + (recv ? "c" : "d") + i);
    });
  }

  function problem(r) {
    if (!r.icFor) return "";
    if (r.icFor === r.entity) return "On behalf of: pick a different company from the one the voucher is in.";
    if (!r.icCharge) return "Choose the account to charge in " + coName(r.icFor) + "'s books.";
    var net = icNet(r.lines);
    if (Math.abs(net) < 0.005) return "Add a line on the intercompany account (Due from " + coName(r.icFor) + " for a payment, Due to for a receipt), so both companies' books agree.";
    if (!icAcc(net > 0 ? "2204" : "1207", r.entity, r.icFor)) return "No intercompany account for " + coName(r.entity) + " found in " + coName(r.icFor) + "'s books. Add one under " + (net > 0 ? "2204 Due to" : "1207 Due from") + " group companies, marked Intercompany.";
    return "";
  }

  async function sync(save, r) {
    var m = mirrorOf(r.id), name = approverName() || "ERP user", now = new Date().toISOString();
    if (m && m.status === "Posted") {
      if (r.reversedBy && !m.reversedBy) {
        var rv = { entity: m.entity, dept: m.dept, opening: "No", vtype: m.vtype, date: m.date > now.slice(0, 10) ? m.date : now.slice(0, 10), payee: m.payee, narration: "Reversal of " + m.ref + ": " + (m.narration || ""), status: "Posted",
          maker: { name: name, at: now }, postedBy: { name: name, at: now, auto: true }, approvals: [], reversalOf: m.id, source: m.source,
          lines: (m.lines || []).map(function (l) { return Object.assign({}, l, { debit: n(l.credit), credit: n(l.debit) }); }) };
        if (isLocked(rv)) { toast(rv.entity + " " + lockTxt(rv.entity) + ": reverse " + m.ref + " there by hand."); return; }
        rv.ref = nextVoucherNo(rv);
        rv.id = await save("journals", rv);
        await save("journals", Object.assign({}, m, { reversedBy: rv.id }));
        toast(m.ref + " in " + coName(m.entity) + " reversed as well (" + rv.ref + ").");
      }
      return;
    }
    if (!r.icFor || r.reversedBy) { if (m) await Store.remove("journals", m.id); return; }
    var why = problem(r);
    if (why) { toast(why); return; }
    var net = icNet(r.lines), amt = Math.abs(Math.round(net * 100) / 100), back = icAcc(net > 0 ? "2204" : "1207", r.entity, r.icFor);
    var lines = net > 0
      ? [{ account: r.icCharge, debit: amt, credit: 0, desc: r.payee || "" }, { account: back.id, debit: 0, credit: amt }]
      : [{ account: back.id, debit: amt, credit: 0 }, { account: r.icCharge, debit: 0, credit: amt, desc: r.payee || "" }];
    var j = Object.assign({}, m || {}, {
      entity: r.icFor, dept: r.dept, opening: "No", vtype: "Journal voucher", date: r.date, payee: coName(r.entity),
      narration: (net > 0 ? "Paid on our behalf by " : "Received on our behalf by ") + coName(r.entity) + (r.ref ? " (" + r.ref + ")" : "") + ": " + (r.narration || ""),
      status: r.status === "Posted" ? "Posted" : "Draft", icOf: r.id, source: { c: "journals", id: r.id, ev: "ic", key: "ic" }, lines: lines
    });
    if (!m) { j.maker = { name: name, at: now }; j.approvals = []; }
    if (j.status === "Posted") { j.postedBy = { name: name, at: now, auto: true }; if (!j.ref) j.ref = nextVoucherNo(j); }
    if (isLocked(j)) { toast(j.entity + " " + lockTxt(j.entity) + ": enter its side of " + (r.ref || "this voucher") + " by hand."); return; }
    await save("journals", j);
    if (j.status === "Posted" && (!m || m.status !== "Posted")) toast("Matching voucher " + j.ref + " posted in " + coName(j.entity) + ".");
  }

  // The chart of accounts came with "Due from ENT1".."ENT5". Once the companies have their own codes, those
  // accounts are renamed to the company (e.g. "Due from JPL") so vouchers and reports show who the balance is with.
  var named = false;
  async function nameIcAccounts() {
    if (named || !Store.data.accounts.length || !(window.FS_BRIDGE && window.FS_BRIDGE.edit)) return;
    named = true;
    var ents = ENTS();
    for (var k = 0; k < Store.data.accounts.length; k++) {
      var a = Store.data.accounts[k], m = /^Due (from|to) ENT(\d)$/.exec(String(a.name || "").trim()), e = m && ents[+m[2] - 1];
      if (!e || e === "ENT" + m[2] || a.ic !== "Yes") continue;
      try { await Store.save("accounts", Object.assign({}, a, { name: "Due " + m[1] + " " + coLabel(e) })); } catch (x) { return; }
    }
  }

  function hook() {
    if (typeof S === "undefined" || !S.journals || typeof submitForm !== "function" || !Store || !Store.save) return false; // eslint-disable-line no-undef
    addFields();
    // Stop the save if the other company's side cannot be made, so the two books never disagree.
    submitForm = (function (old) { // eslint-disable-line no-global-assign, no-undef
      return async function () {
        if (F && F.c === "journals" && !F.rec.source && !F.rec.icOf) {
          readLines();
          var lines = F.lines.filter(function (l) { return l.account; });
          var r = { entity: F.rec.entity || (document.getElementById("f_entity") || {}).value, icFor: (document.getElementById("f_icFor") || {}).value || "",
            icCharge: (document.getElementById("f_icCharge") || {}).value || "", lines: lines };
          var why = problem(r), err = document.getElementById("ferr");
          if (why) { if (err) err.textContent = why; return false; }
        }
        return old.apply(this, arguments);
      };
    })(submitForm); // eslint-disable-line no-undef
    jvSheet = (function (old) { // eslint-disable-line no-global-assign, no-undef
      return function (j) {
        var html = old.apply(this, arguments), h = sideHtml(j), at = html.indexOf("<h4>Finance Document Approval Authority</h4>");
        return h && at >= 0 ? html.slice(0, at) + h + html.slice(at) : html;
      };
    })(jvSheet); // eslint-disable-line no-undef
    var save = Store.save;
    Store.save = async function (c, rec) {
      var id = await save.apply(this, arguments);
      if (c === "journals" && rec && !rec.icOf && !rec.source && (rec.icFor || mirrorOf(id))) {
        var self = this, r = Object.assign({}, rec, { id: id });
        busy[id] = (busy[id] || Promise.resolve()).then(function () { return sync(function (cc, x) { return save.call(self, cc, x); }, r); })
          .catch(function (e) { toast("The matching voucher in the other company was not saved: " + (e && e.message || "error") + ". Enter it by hand."); });
        await busy[id];
      }
      return id;
    };
    var remove = Store.remove;
    Store.remove = async function (c, id) {
      var m = c === "journals" ? mirrorOf(id) : null;
      var out = await remove.apply(this, arguments);
      if (m && m.status !== "Posted") await remove.call(this, "journals", m.id);
      return out;
    };
    var waits = 0, nm = setInterval(function () { if (named || ++waits > 30) { clearInterval(nm); return; } nameIcAccounts(); }, 2000);
    new MutationObserver(trim).observe(document.body, { childList: true, subtree: true });
    return true;
  }
  var tries = 0;
  function start() { if (!hook() && ++tries < 60) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
