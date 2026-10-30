// Full details of the maker and the authorisers on every voucher (hassan, 2026-10-29: "while creating voucher or on
// printing it the maker full details and authorizers full details are not appearing").
// The printed voucher's sign-off table and the voucher form both show, for Prepared by (Maker), Senior Manager,
// Group GM Finance and Posted by: the person's name, designation and e-mail (from FlowSuit ERP, Users and access),
// the status and the date and time. With approval on paper the approvers' names come from who holds that approval
// role, and the status, date and signature are left for the pen. window.FS_SIGN.people comes from hsec_signers().
(function () {
  /* global jvSheet, jvStages, PAPER, F, esc */
  var C = window.FS_SIGN || {}, P = C.people || {};
  var ROLE = { "senior manager": "senior", "group gm finance": "gmf" };
  var low = function (v) { return String(v || "").trim().toLowerCase(); };
  var paper = function () { return typeof PAPER === "function" ? PAPER() : !C.on; };
  var when = function (x) { return x ? new Date(x).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : ""; };
  function person(rec) {
    if (!rec) return null;
    if (rec.uid && P[rec.uid]) return P[rec.uid];
    var k = Object.keys(P).find(function (id) { return low(P[id].name) === low(rec.name); });
    return k ? P[k] : (rec.name ? { name: rec.name, email: "", title: "" } : null);
  }
  function holders(role) { return Object.keys(P).map(function (id) { return P[id]; }).filter(function (u) { return u.role === role; }); }
  function join(list, k) { return list.map(function (u) { return u[k] || ""; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(" / "); }
  function rows(j) {
    var ap = j.approvals || [], out = [], pap = paper();
    var mk = j.maker || (j.id ? null : { uid: C.me, at: "" }), mp = person(mk) || (j.id ? null : P[C.me]);
    out.push({ role: "Prepared by (Maker)", who: mp ? [mp] : [], st: j.maker ? "Prepared" : j.id ? "" : "Preparing", at: j.maker ? j.maker.at : "" });
    var stages = typeof jvStages === "function" ? jvStages(j) : [];
    stages.forEach(function (s) {
      var a = ap.filter(function (y) { return y.stage === s.role && y.action === "Approved"; }).slice(-1)[0];
      if (a && !pap) out.push({ role: s.role, who: [person(a)], st: "Approved", at: a.at, ok: 1 });
      else out.push({ role: s.role, who: holders(ROLE[low(s.role)] || ""), st: pap ? "Sign on paper" : "Pending", at: "" });
    });
    if (j.postedBy && j.postedBy.name) out.push({ role: "Posted in the ERP by", who: [person(j.postedBy)], st: "Posted", at: j.postedBy.at, post: 1 });
    return out;
  }
  function nameCell(r) { return r.who.length ? join(r.who, "name") : ""; }
  // printed voucher: same columns as before plus Designation and E-mail; hsec-sign.js finds the name, status
  // and signature cells by their data attributes
  function sheetTable(j) {
    var h = "<table class=\"auth fs-signoff\"><thead><tr><th>Authority</th><th>Name</th><th>Designation</th><th>E-mail</th><th>Status</th><th>Date &amp; Time</th><th>Signature</th></tr></thead><tbody>";
    rows(j).forEach(function (r) {
      var nm = nameCell(r), one = r.who.length === 1;
      h += "<tr><td class=\"role\">" + esc(r.role) + "</td><td data-signame=\"" + esc(one ? nm : "") + "\">" + esc(nm) + "</td><td>" + esc(join(r.who, "title")) + "</td><td class=\"fs-mail\">" + esc(join(r.who, "email")) +
        "</td><td data-sigst=\"" + (r.ok || /^Prepared/.test(r.role) || r.post ? "Approved" : "") + "\">" + (r.st ? "<span class=\"st" + (r.ok || r.post || r.st === "Prepared" ? " ok" : "") + "\">" + esc(r.st) + "</span>" : "") +
        "</td><td>" + esc(when(r.at)) + "</td><td class=\"fs-sigcell\"></td></tr>";
    });
    return h + "</tbody></table>";
  }
  function formTable(j) {
    var h = "<div id=\"fsSignoff\" class=\"fs-signoff-form\"><b>Sign-offs on this voucher</b><table class=\"chain\"><thead><tr><th>Authority</th><th>Name</th><th>Designation</th><th>E-mail</th><th>Status</th><th>Date &amp; time</th></tr></thead><tbody>";
    rows(j).forEach(function (r) { h += "<tr><td>" + esc(r.role) + "</td><td>" + esc(nameCell(r) || "Not given yet") + "</td><td>" + esc(join(r.who, "title") || "–") + "</td><td>" + esc(join(r.who, "email") || "–") + "</td><td>" + esc(r.st || "–") + "</td><td>" + esc(when(r.at) || "–") + "</td></tr>"; });
    var none = Object.keys(P).some(function (id) { return P[id].role && !P[id].title; });
    return h + "</tbody></table>" + (none ? "<p class=\"muted\" style=\"margin:4px 0 0\">Missing a designation? Add it in FlowSuit ERP, Users and access, under each person.</p>" : "") + "</div>";
  }
  function hook() {
    if (typeof jvSheet !== "function" || typeof esc !== "function") return false;
    var old = jvSheet;
    jvSheet = function (j) { // eslint-disable-line no-global-assign
      var html = old.apply(this, arguments);
      try {
        var d = document.createElement("div"); d.innerHTML = html;
        var t = d.querySelector(".pvch table.auth");
        if (t) { t.outerHTML = sheetTable(j); html = d.innerHTML; }
      } catch (e) { console.warn(e); }
      return html;
    };
    var last = "";
    new MutationObserver(function () {
      if (typeof F === "undefined" || !F || F.c !== "journals" || !F.rec) return;
      var frm = document.getElementById("frm"), calc = frm && frm.querySelector(".calc"); if (!calc) return;
      var html = formTable(F.rec), cur = document.getElementById("fsSignoff");
      if (cur && cur.parentNode === calc && html === last) return;
      last = html; if (cur) cur.remove();
      calc.insertAdjacentHTML("beforeend", html);
    }).observe(document.body, { childList: true, subtree: true });
    var css = document.createElement("style");
    css.textContent = ".fs-signoff-form{margin-top:12px}.fs-signoff-form table{width:100%;margin-top:6px}.fs-signoff-form td,.fs-signoff-form th{font-size:12px;padding:4px 6px;text-align:left;vertical-align:top}" +
      ".pvch table.fs-signoff td.role{width:17%}.pvch table.fs-signoff td.fs-mail{font-size:10px;overflow-wrap:anywhere}";
    document.head.appendChild(css);
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
