// Puts each person's signature (uploaded in FlowSuit ERP, Users and access) on the printed voucher: in the
// approval table, beside "Prepared by" and beside every stage that has been approved. window.FS_SIGN comes
// from hsec_access_inject(); names on vouchers are the signed-in names, which the server fills in.
(function () {
  var C = window.FS_SIGN;
  if (!C || !C.on || !C.sigs) return;
  function fill() {
    document.querySelectorAll(".pvch table.auth tbody tr").forEach(function (tr) {
      var td = tr.children;
      if (td.length < 5 || td[4].querySelector("img.fs-sig")) return;
      var who = (td[1].textContent || "").trim(), url = C.sigs[who];
      if (!url) return;
      if (!/approved/i.test(td[2].textContent || "") && !/^prepared by/i.test((td[0].textContent || "").trim())) return;
      var img = document.createElement("img");
      img.className = "fs-sig";
      img.src = url;
      img.alt = "Signature of " + who;
      td[4].appendChild(img);
    });
  }
  function start() {
    if (!document.body) return setTimeout(start, 50);
    new MutationObserver(fill).observe(document.body, { childList: true, subtree: true });
  }
  start();
})();
