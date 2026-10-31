// Account pickers list only the accounts that fit the box (hassan, 2026-10-30: "on each drop down full detail opens,
// only the relevant details should be shown as per the head"): a bank box lists bank accounts, an expense box lists
// expense accounts, and so on, in the form's company. A field asks for this with af (a kind below) on its definition;
// the app's own boxes that are plainly one kind get it here. An account already chosen always stays in the list.
(function () {
  /* global S, F, Store, fieldHtml */
  var cashLike = function (a) { return /petty|cash in hand/i.test(a.name || ""); };
  var KIND = {
    petty: function (a) { return /^1210/.test(a.code) && cashLike(a); },
    // bank accounts, and running finance (an overdraft is paid from like a bank)
    bank: function (a) { return (/^1210/.test(a.code) && !cashLike(a)) || (/^2208/.test(a.code) && /running finance|overdraft/i.test(a.name || "")); },
    cashbank: function (a) { return /^1210/.test(a.code) || (/^2208/.test(a.code) && /running finance|overdraft/i.test(a.name || "")); },
    expense: function (a) { return /^(5|6|72|8)/.test(a.code); },
    // what a payment demand is owed on: current liabilities other than bank finance and taxes withheld
    payable: function (a) { return /^22/.test(a.code) && !/^22(03|08)/.test(a.code); },
    // what an advance is spent on: costs and expenses, stock and other current assets
    spend: function (a) { return /^(5|6|72|8|12)/.test(a.code) && !/^1210/.test(a.code); }
  };
  var APP = { adminExp: { expAccount: "expense", paidFrom: "cashbank" }, taxes: { paidFrom: "bank" }, advances: { glAccount: "spend" } };

  function hook() {
    if (typeof S === "undefined" || typeof fieldHtml !== "function" || typeof Store === "undefined") return false;
    Object.keys(APP).forEach(function (c) {
      if (!S[c]) return;
      S[c].fields.forEach(function (f) { if (f.t === "acc" && APP[c][f.k] && !f.af) f.af = APP[c][f.k]; });
    });
    fieldHtml = (function (old) { // eslint-disable-line no-global-assign
      return function (f, v) {
        var test = f && f.t === "acc" && KIND[f.af];
        if (!test) return old.apply(this, arguments);
        var ent = typeof F !== "undefined" && F && F.rec ? F.rec.entity : "";
        var all = Store.data.accounts;
        // headers stay so the list keeps its groups; the app drops the empty ones
        Store.data.accounts = all.filter(function (a) { return a.posting === "Header" || a.id === v || (test(a) && (!a.entity || !ent || a.entity === ent)); });
        try { return old.apply(this, arguments); } finally { Store.data.accounts = all; }
      };
    })(fieldHtml);
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
