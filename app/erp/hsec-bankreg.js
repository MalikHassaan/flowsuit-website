// Bank ledger accounts show in the bank register by themselves (hassan, 2026-11-27: "if it's in the ledger it should
// show in bank facility as well"). Every posting sub account under 1210 (bank current / savings, not cash in hand or
// petty cash) or 2208 (running finance) that no Bank accounts & facilities record is linked to gets one, linked to
// that ledger account: bank = the account's name, company = the account's company, else the company code in its name,
// else the first company. Runs for an admin a few seconds after the records load, then every minute, so accounts
// added later appear too. Accounts set "Show in pick lists? No" are left out. Opening balance stays blank: the books
// balance is whatever is already posted to the ledger account.
(function () {
  /* global Store, S, ENTS, isPost, toast */
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var busy = false, seen = 0;

  function entityOf(a) {
    var ents = safe(function () { return ENTS(); }, []) || [];
    if (a.entity && ents.indexOf(a.entity) >= 0) return a.entity;
    var name = String(a.name || ""), m = name.match(/\(([^)]+)\)\s*$/);
    if (m && ents.indexOf(m[1].trim()) >= 0) return m[1].trim();
    for (var i = 0; i < ents.length; i++) {
      if (new RegExp("(^|[^A-Za-z0-9])" + ents[i].replace(/[^A-Za-z0-9]/g, "") + "([^A-Za-z0-9]|$)", "i").test(name)) return ents[i];
    }
    return ents[0] || "";
  }
  function bankName(a) { return String(a.name || "").replace(/\s*\([^)]*\)\s*$/, "").trim() || a.code; }

  async function run() {
    if (busy || !window.FS_ADMIN || !(window.FS_BRIDGE && FS_BRIDGE.edit)) return;
    var D = Store.data; if (!D || !D.accounts || !D.accounts.length || !D.banks) return;
    var linked = {}, ids = {};
    D.banks.forEach(function (b) { if (b.glAcc) linked[b.glAcc] = 1; ids[b.id] = 1; });
    var todo = D.accounts.filter(function (a) {
      return safe(function () { return isPost(a); }, a.posting !== "Header") && /^(1210|2208)\d+$/.test(String(a.code)) && !/cash in hand|petty/i.test(a.name || "")
        && a.hidden !== "Yes" && !linked[a.id] && !ids["bk-" + a.id];
    });
    if (!todo.length) return;
    busy = true;
    var made = 0;
    try {
      for (var i = 0; i < todo.length; i++) {
        var a = todo[i];
        var rec = { id: "bk-" + a.id, bank: bankName(a), account: "", entity: entityOf(a), type: /^2208/.test(a.code) ? "Running finance" : "Current",
          glAcc: a.id, fromLedger: "Yes", notes: "Added from the chart of accounts (" + a.code + "). Add the account no. and statement balance." };
        if (!rec.entity) continue;
        try { await Store.save("banks", rec); made++; } catch (e) { console.warn("bank register", a.code, e); }
      }
    } finally { busy = false; }
    if (made) safe(function () { toast(made + " bank account" + (made > 1 ? "s" : "") + " from the chart of accounts added to Bank accounts & facilities."); });
  }

  function start() {
    if (typeof Store === "undefined" || !Store.data || !Store.data.accounts || !Store.data.accounts.length) return false;
    setTimeout(function () { run().catch(function () {}); }, 4000);
    setInterval(function () { if (!document.hidden) run().catch(function () {}); }, 60000);
    return true;
  }
  var t = setInterval(function () { if (start() || ++seen > 300) clearInterval(t); }, 1000);
})();
