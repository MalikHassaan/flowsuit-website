// Voucher list order (hassan, 2026-11-18: "when an entry is being saved it is not shown on the maker screen ... sort by
// the date and on top all vouchers which are being prepared should be sorted by the date"). Vouchers still being
// prepared (Draft, Pending approval, Approved, Rejected: anything not yet Posted) come first, newest date first; posted
// vouchers follow, newest date first. Same date: the most recently saved first. A voucher just saved also clears a
// status filter that would hide it, so the maker always sees what they saved.
(function () {
  /* global S, Store */
  var open = function (r) { return String((r && r.status) || "") !== "Posted"; };
  function order(a, b) {
    var oa = open(a), ob = open(b);
    if (oa !== ob) return oa ? -1 : 1;
    return String(b.date || "").localeCompare(String(a.date || "")) ||
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) ||
      String(b.ref || "").localeCompare(String(a.ref || ""));
  }
  function start() {
    if (typeof S === "undefined" || !S.journals || typeof Store === "undefined" || !Store.save) return setTimeout(start, 300);
    S.journals.sort = order;
    if (Store.save.fsJvSort) return;
    var old = Store.save;
    var save = async function (c, rec) {
      var r = await old.apply(this, arguments);
      if (c === "journals" && rec && window.FS_STF) {
        var want = window.FS_STF.get("journals");
        if (want && want !== String(rec.status || "")) setTimeout(function () { try { window.FS_STF.set(""); } catch (e) { /* list not on screen */ } }, 400);
      }
      return r;
    };
    save.fsJvSort = true;
    Store.save = save;
  }
  start();
})();
