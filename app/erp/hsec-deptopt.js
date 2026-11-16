// Department on vouchers is optional (hassan, 2026-11-16: "what is the purpose of department in the entry" ... "make it
// optional"). The app refuses to save, submit or post a voucher with no department ("Choose the department."). A
// voucher left without one is now saved with "Not assigned", so it goes through, and the label no longer says it is
// required. A department chosen on the voucher or its lines still counts as before (payroll posting by department).
(function () {
  /* global F */
  var NONE = "Not assigned";
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var isJv = function () { return safe(function () { return F && F.c === "journals"; }, false); };
  function fillIn() {
    var s = document.getElementById("f_dept");
    if (!s || !isJv() || s.value) return;
    if (![].slice.call(s.options).some(function (o) { return o.value === NONE; })) { var o = document.createElement("option"); o.value = NONE; o.textContent = NONE; s.appendChild(o); }
    s.value = NONE;
    s.dispatchEvent(new Event("change", { bubbles: true }));
  }
  // before the app's own checks: Save (and Save & post), Submit for approval, Post
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#jvSubmit, #jvPost, #frm button[type=submit]");
    if (b) safe(fillIn, null);
  }, true);
  document.addEventListener("submit", function (e) { if (e.target && e.target.id === "frm") safe(fillIn, null); }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target && e.target.closest && e.target.closest("#frm")) safe(fillIn, null); }, true);
  // the label and hint
  function relabel() {
    if (!isJv()) return;
    var s = document.getElementById("f_dept"), box = s && s.closest(".f"); if (!box || box.getAttribute("data-fsdo")) return;
    box.setAttribute("data-fsdo", "1");
    var l = box.querySelector("label"); if (l) l.textContent = "Department (optional)";
    var h = box.querySelector(".hint"); if (h) h.textContent = "Optional. Left blank, the voucher shows Not assigned. Lines can name their own department.";
  }
  (function watch() {
    if (!document.body) return setTimeout(watch, 300);
    new MutationObserver(function () { safe(relabel, null); }).observe(document.body, { childList: true, subtree: true });
  })();
})();
