// Chart of accounts names in CAPITAL LETTERS (hassan, 2026-11-03: "chart of account whenever it be created new main and
// sub category it should always be in capital letters as rest of it").
//  * every account saved (new head or sub account, from the Chart of accounts form, the voucher's quick add or the
//    automatic group-loan / intercompany accounts) is saved with its name in capitals;
//  * the name box on the account form turns what is typed into capitals as it is typed;
//  * when an admin opens the ERP, any existing account still in small letters is renamed to capitals once
//    (only the name changes: code, balances and postings stay as they are).
(function () {
  /* global Store, F */
  var up = function (s) { return String(s == null ? "" : s).toUpperCase(); };
  function hook() {
    if (typeof Store === "undefined" || typeof Store.save !== "function") return false;
    var save = Store.save;
    Store.save = function (c, rec) {
      if (c === "accounts" && rec && typeof rec.name === "string" && /[a-z]/.test(rec.name)) rec.name = up(rec.name); // in place: addAccount reuses rec
      return save.apply(this, arguments);
    };
    return true;
  }
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t || t.id !== "f_name" || typeof F === "undefined" || !F || F.c !== "accounts" || !/[a-z]/.test(t.value)) return;
    var a = t.selectionStart, b = t.selectionEnd; t.value = up(t.value);
    try { t.setSelectionRange(a, b); } catch (x) { /* not a text box */ }
  }, true);
  var done = false;
  async function fixOld() {
    if (done || !window.FS_ADMIN || !(window.FS_BRIDGE && window.FS_BRIDGE.edit) || !Store.loaded || !(Store.data.accounts || []).length) return;
    done = true;
    var todo = Store.data.accounts.filter(function (a) { return /[a-z]/.test(String(a.name || "")); });
    for (var i = 0; i < todo.length; i++) {
      try { await Store.save("accounts", Object.assign({}, todo[i], { name: up(todo[i].name) })); } catch (x) { console.warn("caps", x); return; }
    }
  }
  function start() {
    if (!hook()) return setTimeout(start, 300);
    var n = 0, t = setInterval(function () { n++; if (done || n > 60) return clearInterval(t); fixOld(); }, 2000);
  }
  start();
})();
