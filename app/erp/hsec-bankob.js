// Opening balance on the bank form (hassan, 2026-11-27: "while making the new banks there should be opening balance
// option also"). Bank account / facility form gets "Opening balance in books", "Opening balance date" and "Other side of
// the opening entry". On save the bank's ledger account is opened as before, then one opening balances voucher is made:
// Dr the bank's ledger account, Cr the other side (reversed when overdrawn), marked as an opening balances voucher and
// sent through the normal approval like any voucher. Entered once (hassan, 2026-11-27: "just for once, once the bank is
// created that amount is fixed"): after the voucher exists the three boxes are read-only and a changed value is put back.
// Bank reconciliation counts the posted opening line as already on the statement (it is the brought-forward balance),
// so it never shows as an uncleared receipt.
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
    if (old) return; // entered once: the voucher is never changed from the bank form
    var codes = accByCode(), contra = b.obContra || (codes[DEF] && codes[DEF].id) || "";
    if (!contra) { toast("Choose the other side of the opening entry, then save the bank again."); return; }
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
      if (c === "banks" && rec && rec.id && ourJv(rec.id)) { // fixed once made: keep the values the voucher was made from
        var prev = (Store.data.banks || []).find(function (x) { return x.id === rec.id; }) || {};
        ["obAmt", "obDate", "obContra"].forEach(function (k) { if (prev[k] !== undefined) rec[k] = prev[k]; else delete rec[k]; });
      }
      var id = await save.apply(this, arguments);
      if (c === "banks" && rec && (rec.obAmt || rec.obContra || rec.obDate) && !rec.sample) {
        var b = Object.assign({}, rec, { id: id || rec.id });
        try { await sync(b); } catch (e) { console.warn(e); safe(function () { toast("Bank saved, but the opening balance voucher was not made: " + (e.message || e)); }); }
      }
      return id;
    };
  }

  // read-only boxes on a bank whose opening voucher exists
  function lockForm() {
    var f = safe(function () { return F; }, null);
    if (!f || f.c !== "banks" || !f.rec || !f.rec.id) return;
    var j = ourJv(f.rec.id); if (!j) return;
    ["obAmt", "obDate", "obContra"].forEach(function (k) {
      var el = document.getElementById("f_" + k); if (!el || el.dataset.fsObLock) return;
      el.dataset.fsObLock = "1"; el.disabled = true; el.title = "Fixed: entered once, in voucher " + (j.ref || "");
    });
    var a = document.getElementById("f_obAmt");
    if (a && !document.getElementById("fsObNote")) {
      var d = document.createElement("div"); d.id = "fsObNote"; d.className = "hint";
      d.textContent = "Fixed. Entered once as voucher " + (j.ref || "") + " (" + j.status + "). A correction needs a separate journal voucher.";
      (a.closest(".field") || a.parentNode).appendChild(d);
    }
  }

  // bank reconciliation: the posted opening line is the brought-forward balance, so it counts as already cleared
  function wrapRec() {
    if (typeof brState !== "function" || brState.__fsOb) return;
    var old = brState;
    brState = function (ent) {
      var R = old.apply(this, arguments);
      safe(function () {
        var B = V.br, acc = B && B.acc; if (!B || !B.set || !acc) return;
        var add = 0;
        (Store.data.journals || []).forEach(function (j) {
          if (j.status !== "Posted" || j.entity !== ent || j.date > B.date || !(j.source && j.source.c === "banks" && j.source.ev === "ob")) return;
          (j.lines || []).forEach(function (l, i) { var k = j.id + ":" + i; if (l.account === acc && !B.set.has(k)) { B.set.add(k); add++; } });
        });
        if (add) R = old.apply(this, [ent]);
      }, null);
      return R;
    };
    brState.__fsOb = true;
  }

  function init() {
    if (typeof S === "undefined" || typeof Store === "undefined") return false;
    addFields(); wrap(); wrapRec();
    new MutationObserver(function () { safe(lockForm, null); }).observe(document.body, { childList: true, subtree: true });
    return true;
  }
  if (!init()) { var n = 0, t = setInterval(function () { if (init() || ++n > 100) clearInterval(t); }, 200); }
})();
