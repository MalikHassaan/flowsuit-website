// Opening balance on the bank form (hassan, 2026-11-27: "while making the new banks there should be opening balance
// option also"). Bank account / facility form gets "Opening balance in books", "Opening balance date" and "Other side of
// the opening entry". On save the bank's ledger account is opened as before, then one opening balances voucher is made:
// Dr the bank's ledger account, Cr the other side (reversed when overdrawn), marked as an opening balances voucher and
// sent through the normal approval like any voucher. Editing the bank later updates that voucher while it is not yet
// approved; once approved or posted it is left alone and a toast says to correct it with a reversing voucher.
(function () {
  /* global S, Store, toast, accByCode, isLocked, lockTxt, nextVoucherNo, approverName, todayStr, autoMode, PAPER, jvTot */
  var num = function (x) { return +String(x == null ? "" : x).replace(/,/g, "") || 0; };
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var DEF = "310302"; // unappropriated profit / retained earnings: where balances from before the ERP sit

  function addFields() {
    var B = S && S.banks, F = B && B.fields;
    if (!F || F.some(function (f) { return f.k === "obAmt"; })) return;
    var at = F.findIndex(function (f) { return f.k === "asOf"; });
    if (at < 0) at = F.length - 1;
    F.splice(at + 1, 0,
      { k: "obAmt", l: "Opening balance in books (PKR, negative if overdrawn)", t: "money", neg: 1,
        hint: "Only for money already in this account before you started it in the ERP. On save an opening balances voucher is made for approval. Leave blank if the account starts at zero, or if the opening balances voucher already includes it." },
      { k: "obDate", l: "Opening balance date", t: "date", hint: "The date the balance is at. Left blank: the day before the voucher is made." },
      { k: "obContra", l: "Other side of the opening entry", t: "acc",
        hint: "Usually " + DEF + " (retained earnings) for a balance brought from before the ERP. If the money came from another bank, leave the opening balance blank and post a bank transfer instead." });
  }

  function ourJv(id) {
    return (Store.data.journals || []).find(function (j) { return j.source && j.source.c === "banks" && j.source.id === id && j.source.ev === "ob"; });
  }
  function dayBefore(d) { var x = new Date(d + "T00:00:00"); x.setDate(x.getDate() - 1); return x.toISOString().slice(0, 10); }

  async function sync(b) {
    var amt = Math.round(num(b.obAmt) * 100) / 100, old = ourJv(b.id);
    if (!b.glAcc || (!amt && !old)) return;
    if (old && ["Approved", "Posted"].indexOf(old.status) >= 0) {
      var same = Math.abs(jvTot(old).dr - Math.abs(amt)) < 0.5;
      if (!same) toast("Opening balance voucher " + (old.ref || "") + " is already " + old.status.toLowerCase() + ". Correct the balance with a reversing voucher.");
      return;
    }
    var codes = accByCode(), contra = b.obContra || (codes[DEF] && codes[DEF].id) || "";
    if (!contra) { toast("Choose the other side of the opening entry, then save the bank again."); return; }
    if (old && !amt) { // balance removed before approval: take the voucher out of approval
      await Store.save("journals", Object.assign({}, old, { status: "Rejected", narration: (old.narration || "") + " (opening balance removed from the bank form)" }));
      return;
    }
    var date = b.obDate || (old && old.date) || dayBefore(todayStr()), a = Math.abs(amt), dr = amt > 0;
    var name = safe(approverName, "") || "ERP user", now = new Date().toISOString();
    var j = Object.assign({}, old || {}, {
      vtype: "Journal voucher", entity: b.entity, date: date, dept: "Finance & Accounts", opening: "Yes", payee: b.bank,
      narration: "Opening balance of " + b.bank + (b.account ? " " + b.account : "") + " as at " + date + " brought forward",
      lines: [{ account: b.glAcc, debit: dr ? a : 0, credit: dr ? 0 : a, desc: "Opening balance" },
              { account: contra, debit: dr ? 0 : a, credit: dr ? a : 0, desc: "Opening balance of " + b.bank }],
      status: safe(function () { return PAPER() ? "Draft" : "Pending approval"; }, "Pending approval"),
      source: { c: "banks", id: b.id, ev: "ob", key: "ob" }, approvals: []
    });
    if (!old) j.maker = { name: name, at: now };
    if (safe(function () { return isLocked(j); }, false)) { toast(b.entity + " " + lockTxt(b.entity) + ". Opening balance voucher not made: change the date."); return; }
    if (!j.ref) j.ref = nextVoucherNo(j);
    await Store.save("journals", j);
    toast((old ? "Opening balance voucher " + j.ref + " updated" : "Opening balance voucher " + j.ref + " made") + ". It goes for approval like any voucher.");
  }

  function wrap() {
    if (typeof Store === "undefined" || Store.__fsBankOb) return;
    Store.__fsBankOb = true;
    var save = Store.save;
    Store.save = async function (c, rec) {
      var id = await save.apply(this, arguments);
      if (c === "banks" && rec && (rec.obAmt || rec.obContra || rec.obDate) && !rec.sample) {
        var b = Object.assign({}, rec, { id: id || rec.id });
        try { await sync(b); } catch (e) { console.warn(e); safe(function () { toast("Bank saved, but the opening balance voucher was not made: " + (e.message || e)); }); }
      }
      return id;
    };
  }

  function init() {
    if (typeof S === "undefined" || typeof Store === "undefined") return false;
    addFields(); wrap(); return true;
  }
  if (!init()) { var n = 0, t = setInterval(function () { if (init() || ++n > 100) clearInterval(t); }, 200); }
})();
