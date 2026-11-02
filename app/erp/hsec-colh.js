// Company letterheads on vouchers and invoices (hassan, 2026-11-02: "find letter head of JPL and build it accordingly on all
// the vouchers and quotations etc like you make it for hsec").
// The letterhead pictures live in the settings record (settings.coLh, imported under Sales › Quotations › Templates), never
// in this public code. hsec-qtpl.js uses them for quotations; this file adds them to:
//  * every voucher sheet (journal, payment, receipt, purchase and sales vouchers; print and the on-screen sheet): the
//    company's header picture at the top and its footer picture at the bottom;
//  * invoices of that company: print, PDF and the Word file's footer (the Word header already carries the same logo).
(function () {
  /* global jvSheet, IV_LH, IV_IMG, esc */
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var co = function (e) { return safe(function () { return window.FS_QTPL && window.FS_QTPL.company(e); }, null); };
  var fmtOf = function (src) { return /^data:image\/jpe?g/.test(src) ? "JPEG" : "PNG"; };
  var size = {};
  function measure(src) {
    if (!src || size[src]) return;
    size[src] = [1600, 240];
    var i = new Image(); i.onload = function () { size[src] = [i.naturalWidth || 1600, i.naturalHeight || 240]; }; i.src = src;
  }
  var ratio = function (src) { var s = size[src] || [1600, 240]; return s[1] / s[0]; };

  // ---- vouchers
  function sheet(html, j) {
    var c = co(j && j.entity); if (!c || typeof html !== "string") return html;
    var d = document.createElement("template"); d.innerHTML = html;
    var p = d.content.querySelector(".pvch"); if (!p || p.querySelector(".fs-colh")) return html;
    p.classList.add("fs-haslh");
    p.insertAdjacentHTML("afterbegin", "<div class=\"fs-colh\"><img src=\"" + c.head + "\" alt=\"" + safe(function () { return esc(c.name); }, "") + "\"></div>");
    if (c.foot) p.insertAdjacentHTML("beforeend", "<div class=\"fs-colf\"><img src=\"" + c.foot + "\" alt=\"\"></div>");
    return d.innerHTML;
  }

  // ---- invoices: the company's IV_LH entry follows the imported letterhead; the original is kept to go back to
  var orig = {};
  function invoices() {
    if (typeof IV_LH === "undefined" || typeof IV_IMG === "undefined") return;
    var ents = Object.keys(IV_LH).concat(safe(function () { return window.FS_QTPL.companies(); }, []) || []);
    ents.forEach(function (e) {
      var c = co(e);
      if (!(e in orig)) orig[e] = IV_LH[e] || null;
      if (!c) { if (orig[e]) IV_LH[e] = orig[e]; else delete IV_LH[e]; return; }
      measure(c.head); measure(c.foot);
      var key = c.head.length + ":" + (c.foot || "").length + ":" + ratio(c.head) + ":" + ratio(c.foot);
      if (IV_LH[e] && IV_LH[e].fsCo === key) return;
      var hk = "colh_" + e + "_h", fk = "colh_" + e + "_f";
      IV_IMG[hk] = { src: c.head, w: 1600, h: 1600 * ratio(c.head) };
      if (c.foot) IV_IMG[fk] = { src: c.foot, w: 1600, h: 1600 * ratio(c.foot) };
      var W = 182, hH = function () { return Math.min(28, W * ratio(c.head)); }, fH = function () { return c.foot ? Math.min(24, W * ratio(c.foot)) : 0; };
      var base = orig[e] || {};
      IV_LH[e] = {
        fsCo: key,
        top: Math.max(base.top || 30, 7 + 28 + 3), bottom: Math.max(base.bottom || 20, 6 + 24 + 4),
        head: function () { return "<div class=\"iv-lh fs-ivlh\"><img src=\"" + c.head + "\" alt=\"\" style=\"width:100%;height:auto\"></div>"; },
        foot: function () { return c.foot ? "<div class=\"iv-lh fs-ivlh\"><img src=\"" + c.foot + "\" alt=\"\" style=\"width:100%;height:auto\"></div>" : ""; },
        pdf: function (pdf) {
          pdf.addImage(c.head, fmtOf(c.head), 14, 7, W, hH());
          if (c.foot) pdf.addImage(c.foot, fmtOf(c.foot), 14, 297 - 7 - fH(), W, fH());
        },
        docx: {
          head: base.docx && e === "JPL" ? base.docx.head : [{ img: hk, w: W, h: hH(), align: "center" }],
          foot: c.foot ? [{ img: fk, w: W, h: fH(), align: "center" }] : []
        }
      };
    });
  }

  function hook() {
    if (typeof jvSheet !== "function" || !window.FS_QTPL) return false;
    var old = jvSheet;
    jvSheet = function (j) { // eslint-disable-line no-global-assign
      var html = old.apply(this, arguments);
      return safe(function () { return sheet(html, j); }, html);
    };
    safe(invoices, null);
    // the letterhead can be imported or removed while the app is open
    setInterval(function () { safe(invoices, null); }, 3000);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".pvch .fs-colh{margin:0 0 10px}.pvch .fs-colh img,.pvch .fs-colf img{display:block;width:100%;height:auto}" +
    ".pvch .fs-colf{margin-top:18px;padding-top:4px}.pvch.fs-haslh .vh .colg,.pvch.fs-haslh .vh .codet{display:none}" +
    ".iv-lh.fs-ivlh{padding-bottom:4px}.iv-lh.fs-ivlh img{display:block}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
