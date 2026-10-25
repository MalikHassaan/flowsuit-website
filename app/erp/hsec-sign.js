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
  // Once a voucher is sent for approval, only the Senior Manager and the Group GM Finance may change, cancel or
  // reverse it. The server refuses anyone else; this just takes the buttons away and says why.
  var senior = C.jv === "senior" || C.jv === "gmf";
  function lock() {
    var frm = document.getElementById("frm");
    if (!frm) return;
    var rec = null;
    try { /* global F */ rec = typeof F !== "undefined" && F && F.c === "journals" ? F.rec : null; } catch (x) {}
    if (!rec) return;
    var rev = document.getElementById("jvReverse");
    if (senior) {
      // With approval in the system the app has no Reverse button, so it is added here. The app's own handler
      // (it listens for clicks on #jvReverse) posts the reversing voucher.
      var pr = document.getElementById("jvPrint");
      if (!rev && pr && rec.id && rec.status === "Posted" && (!rec.source || rec.source.c === "fatracc") && !rec.reversedBy && !rec.reversalOf) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn danger"; b.id = "jvReverse"; b.textContent = "Reverse voucher";
        pr.insertAdjacentElement("afterend", b);
      }
      return;
    }
    if (rev) rev.remove();
    if (["Pending approval", "Approved", "Rejected"].indexOf(rec.status) < 0 || !rec.maker) return;
    var del = document.getElementById("delBtn");
    if (del) del.remove();
    if (rec.status === "Rejected" || frm.querySelector(".fs-lock")) return;
    frm.querySelectorAll('button[type=submit]').forEach(function (b) { b.disabled = true; b.title = "Only the Senior Manager or Group GM Finance can change it now"; });
    var note = document.createElement("p");
    note.className = "banner warn fs-lock";
    note.textContent = "This voucher has been sent for approval. Only the Senior Manager or the Group GM Finance can change, cancel or reverse it now.";
    frm.insertBefore(note, frm.firstChild);
  }
  function start() {
    if (!document.body) return setTimeout(start, 50);
    new MutationObserver(function () { fill(); lock(); }).observe(document.body, { childList: true, subtree: true });
  }
  start();
})();
