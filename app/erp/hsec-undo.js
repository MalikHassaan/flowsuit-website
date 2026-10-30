// Correct or remove a posted document from its own screen (hassan, 2026-10-30: "if any amendment is required like reverse
// and delete then it should happen on the same screen rather than we go to the ledger"). A bill, petty cash slip, invoice
// or any record whose voucher is in the ledger gets two buttons:
// * Reverse and delete: posts a reversing voucher for each of its posted vouchers (dated today, or the voucher's date if
//   later), removes its unposted ones, then deletes the record.
// * Reverse and correct: the same, then opens a copy of the record to fix and save again, which posts a new voucher.
// A voucher form shows the same buttons for the document it came from. Every other posted voucher (manual, imported
// from QuickBooks) gets "Reverse voucher" and "Reverse and correct" (hassan: "it should happen on all vouchers"), and the
// voucher view opened from the eye or a voucher number has "Amend or reverse", which opens it.
// Files attached to a deleted record move to its reversed voucher, so the eye there still shows them.
// The server still decides who may reverse (Senior Manager, Group GM Finance, admin) and refuses locked months.
(function () {
  /* global Store, F, srcJvs, approverName, nextVoucherNo, todayStr, n, isLocked, lockTxt, toast, closeForm, openForm, drawForm, DOCNAME, sheetOpen, jvSheet */
  var ask = "", STRIP = ["id", "jvId", "jvIds", "status", "approvals", "postedBy", "maker", "sample", "reversedBy", "source", "claim", "signoff"];
  var posted = function (j) { return j.status === "Posted" || j.status === "Approved"; };
  function target() {
    if (typeof F === "undefined" || !F || !F.rec || !F.rec.id) return null;
    if (F.c === "journals") {
      var j = Store.data.journals.find(function (x) { return x.id === F.rec.id; }) || F.rec;
      if (j.reversalOf || j.reversedBy || !posted(j)) return null;
      if (j.source && j.source.c && j.source.id && Store.data[j.source.c] && j.source.c !== "qbimport") {
        var d = Store.data[j.source.c].find(function (x) { return x.id === j.source.id; });
        if (d) return { c: j.source.c, rec: d };
      }
      return { c: "journals", rec: j }; // manual, QuickBooks-imported, or its document is gone
    }
    var js = srcJvs(F.c, F.rec.id).filter(function (x) { return posted(x) && !x.reversedBy && !x.reversalOf; });
    return js.length ? { c: F.c, rec: Store.data[F.c].find(function (x) { return x.id === F.rec.id; }) || F.rec } : null;
  }
  function vouchers(t) {
    return t.c === "journals" ? [t.rec] : srcJvs(t.c, t.rec.id).filter(function (x) { return !x.reversalOf && !x.reversedBy; });
  }
  // another record that points at this one (a claim holding a slip, a payment against a bill...) blocks the delete
  function usedBy(t) {
    if (t.c === "journals") return "";
    if (t.rec.claim) { var cl = (Store.data.pcclaims || []).find(function (x) { return x.id === t.rec.claim; }); if (cl) return "replenishment claim " + (cl.claimNo || ""); }
    for (var c in Store.data) {
      if (c === "journals" || c === t.c || /audit|log|hist|notif|alert|task/i.test(c) || !Array.isArray(Store.data[c])) continue;
      var hit = Store.data[c].find(function (r) { return r && Object.keys(r).some(function (k) { return k !== "id" && (r[k] === t.rec.id || (Array.isArray(r[k]) && r[k].indexOf(t.rec.id) >= 0)); }); });
      if (hit) return (DOCNAME[c] || c) + " " + (hit.billNo || hit.invoiceNo || hit.claimNo || hit.slipNo || hit.ref || hit.name || hit.no || "");
    }
    return "";
  }
  async function reverse(j, name) {
    var now = new Date().toISOString(), rv = { entity: j.entity, dept: j.dept, opening: "No", vtype: j.vtype || "Journal voucher",
      date: todayStr() > j.date ? todayStr() : j.date, payee: j.payee || "", narration: "Reversal of " + j.ref + ": " + (j.narration || ""),
      status: "Posted", maker: { name: name, at: now }, postedBy: { name: name, at: now }, approvals: [], reversalOf: j.id,
      lines: (j.lines || []).map(function (l) { return Object.assign({}, l, { debit: n(l.credit), credit: n(l.debit) }); }) };
    if (j.costCentre) rv.costCentre = j.costCentre;
    if (isLocked(rv)) throw new Error(rv.entity + " " + lockTxt(rv.entity) + ".");
    rv.ref = nextVoucherNo(rv); rv.id = await Store.save("journals", rv);
    await Store.save("journals", Object.assign({}, j, { reversedBy: rv.id }));
    return rv;
  }
  // its supporting documents stay viewable on the reversed voucher (eye)
  function moveFiles(from, to) {
    var C = window.FS_BRIDGE || {}, fd = new FormData(); fd.append("csrf", C.csrf || ""); fd.append("from", from); fd.append("to", to);
    return fetch((C.api || "/erp/m/hsec/api") + "/att/move", { method: "POST", body: fd, credentials: "same-origin" }).catch(function () {});
  }
  async function run(kind, btn) {
    var t = target(), er = document.getElementById("ferr") || {}; if (!t) return;
    var name = approverName(); if (!name) { er.textContent = "Enter your name at the top of the screen first."; return; }
    var js = vouchers(t), post = js.filter(posted), rest = js.filter(function (x) { return !posted(x); });
    var what = t.c === "journals" ? "voucher " + t.rec.ref : (DOCNAME[t.c] || "record");
    if (kind === "del") { var u = usedBy(t); if (u) { er.textContent = "This " + what + " is part of " + u.trim() + ". Take it out of that first, or use Reverse and correct."; return; } }
    if (ask !== kind) {
      ask = kind;
      btn.textContent = kind === "del" ? "Confirm reverse and delete" : kind === "rev" ? "Confirm reverse" : "Confirm reverse and correct";
      er.textContent = "This posts a reversing voucher for " + post.map(function (j) { return j.ref; }).join(", ") +
        (rest.length ? ", removes the unposted voucher " + rest.map(function (j) { return j.ref || "(unnumbered)"; }).join(", ") : "") +
        (t.c === "journals" ? "" : ", then " + (kind === "del" ? "deletes this " + what : "deletes this " + what + " and opens a copy for you to correct and save")) +
        (t.c === "journals" && kind === "fix" ? ", then opens a copy as a new draft voucher" : "") + ". Click Confirm to go ahead.";
      return;
    }
    ask = ""; btn.disabled = true; er.textContent = "Working…";
    try {
      var refs = [];
      for (var i = 0; i < post.length; i++) refs.push((await reverse(post[i], name)).ref);
      for (var k = 0; k < rest.length; k++) await Store.remove("journals", rest[k].id);
      var copy = Object.assign({}, t.rec); STRIP.forEach(function (x) { delete copy[x]; });
      if (t.c !== "journals") {
        if (post.length) await moveFiles(t.c + "/" + t.rec.id, "journals/" + post[0].id);
        await Store.remove(t.c, t.rec.id);
      }
      closeForm();
      toast((t.c === "journals" ? t.rec.ref : what.charAt(0).toUpperCase() + what.slice(1)) + " reversed by " + refs.join(", ") + (t.c !== "journals" ? " and deleted" : "") + ".");
      if (kind === "rev") { var rv = Store.data.journals.find(function (x) { return x.reversalOf === t.rec.id; }); if (rv) sheetOpen(jvSheet(rv)); }
      if (kind === "fix") {
        if (t.c === "journals") { delete copy.ref; copy.narration = copy.narration || ""; }
        openForm(t.c, null, copy);
      }
    } catch (x) { btn.disabled = false; er.textContent = x.message || "Could not reverse."; }
  }
  function buttons() {
    var frm = document.getElementById("frm"), act = frm && frm.querySelector(".actions");
    if (!act || act.querySelector("[data-fsundo]")) return;
    var t = target(); if (!t) return;
    var add = function (kind, label, cls) {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.setAttribute("data-fsundo", kind); b.textContent = label;
      var sp = act.querySelector(".spacer"); act.insertBefore(b, sp || null);
    };
    var doc = t.c === "journals" ? "" : " " + (DOCNAME[t.c] || "record");
    if (t.c === "journals" && !act.querySelector("#jvReverse")) add("rev", "Reverse voucher", "danger");
    add("fix", "Reverse and correct" + (F.c === "journals" ? doc : ""), "");
    if (t.c !== "journals") add("del", "Reverse and delete" + (F.c === "journals" ? doc : ""), "danger");
  }
  function hook() {
    if (typeof Store === "undefined" || !Store.data || typeof drawForm !== "function" || typeof srcJvs !== "function" || typeof nextVoucherNo !== "function" || typeof jvSheet !== "function") return false;
    drawForm = (function (old) { // eslint-disable-line no-global-assign
      return function () { var out = old.apply(this, arguments); ask = ""; try { buttons(); } catch (e) { console.warn(e); } return out; };
    })(drawForm);
    // the voucher view (eye, voucher links) gets a button to open the voucher for amending
    jvSheet = (function (old) { // eslint-disable-line no-global-assign
      return function (j) {
        var html = old.apply(this, arguments);
        if (!j || !j.id || !Store.data.journals.some(function (x) { return x.id === j.id; })) return html;
        return html.replace('<button class="btn" id="closeSheet">Close</button>', '<button class="btn" id="closeSheet">Close</button><button class="btn" data-fsopenjv="' + String(j.id).replace(/"/g, "") + '">' + (posted(j) && !j.reversedBy && !j.reversalOf ? "Amend or reverse" : "Open voucher") + "</button>");
      };
    })(jvSheet);
    document.addEventListener("click", function (e) {
      var o = e.target.closest && e.target.closest("[data-fsopenjv]");
      if (o) { e.preventDefault(); e.stopImmediatePropagation(); var pl = document.getElementById("printLayer"); if (pl) pl.innerHTML = ""; openForm("journals", o.getAttribute("data-fsopenjv")); return; }
      // a record whose vouchers were all reversed already can be deleted
      var d = e.target.closest && e.target.closest("#delBtn");
      if (d && F && F.rec && F.rec.id && F.c !== "journals") {
        var js = srcJvs(F.c, F.rec.id), live = js.filter(function (x) { return posted(x) && !x.reversalOf && !x.reversedBy; });
        if (js.some(posted) && !live.length) {
          e.preventDefault(); e.stopImmediatePropagation();
          if (!confirm("Its vouchers are already reversed. Delete this " + (DOCNAME[F.c] || "record") + "?")) return;
          Store.remove(F.c, F.rec.id).then(function () { closeForm(); toast("Deleted"); }).catch(function (x) { (document.getElementById("ferr") || {}).textContent = x.message || "Could not delete."; });
          return;
        }
      }
      var b = e.target.closest && e.target.closest("[data-fsundo]"); if (!b) return;
      e.preventDefault(); e.stopImmediatePropagation(); run(b.getAttribute("data-fsundo"), b);
    }, true);
    // the app's own "Reverse it instead" message now points at the buttons on this screen
    new MutationObserver(function () {
      var er = document.getElementById("ferr");
      if (er && /cannot be deleted\. Reverse it instead\.$/.test(er.textContent) && document.querySelector("[data-fsundo]")) er.textContent = er.textContent.replace(/Reverse it instead\.$/, "Use Reverse and delete, or Reverse and correct, on this screen.");
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
