// A new account the QuickBooks way (hassan, 2026-10-30: "follow the QuickBooks pattern, he doesn't ask for the code"):
// choose the account type (Expenses, Income, Bank and cash...), then the account it goes under from that type only,
// then the name. The code is filled in by itself and the type, statement line and other settings are copied from
// the account above it, so they sit under "More settings". Editing an existing account is unchanged.
(function () {
  /* global S, F, Store, fieldHtml, openForm, drawForm, accLv */
  var CATS = [
    ["exp", "Expenses", ["5", "6", "72", "8", "9"]],
    ["inc", "Income", ["4", "71"]],
    ["bank", "Bank and cash", ["1210"]],
    ["ca", "Other current assets (receivables, advances, stock)", ["12"], ["1210"]],
    ["fa", "Fixed and other non-current assets", ["11"]],
    ["cl", "Current liabilities (payables, accruals, taxes)", ["22"]],
    ["ll", "Long-term liabilities (loans)", ["21"]],
    ["eq", "Equity", ["3"]]
  ];
  var MORE = ["posting", "type", "fsLine", "contra", "ic", "nonCash", "cfHead", "reviewed"];
  var cat = "exp", open = false;
  var isNew = function () { return typeof F !== "undefined" && F && F.c === "accounts" && F.rec && !F.rec.id; };
  function fits(code) {
    var c = CATS.find(function (x) { return x[0] === cat; }); if (!c) return true;
    code = String(code || "");
    var on = c[2].some(function (p) { return code.startsWith(p) || p.startsWith(code); });
    var off = (c[3] || []).some(function (p) { return code.startsWith(p); });
    return on && !off;
  }

  function hook() {
    if (typeof S === "undefined" || !S.accounts || typeof fieldHtml !== "function" || typeof openForm !== "function" || typeof Store === "undefined") return false;

    openForm = (function (old) { // eslint-disable-line no-global-assign
      return function (c, id, pre) {
        if (c === "accounts" && !id) { open = false; pre = Object.assign({ posting: "Posting" }, pre || {}); }
        return old.call(this, c, id, pre);
      };
    })(openForm);

    fieldHtml = (function (old) { // eslint-disable-line no-global-assign
      return function (f, v) {
        if (!f || !isNew()) return old.apply(this, arguments);
        if (f.k === "parent") {
          // only the accounts of the chosen type
          var all = Store.data.accounts, h;
          Store.data.accounts = all.filter(function (a) { var lv = accLv(a); return lv < 2 || lv > 3 || a.code === v || fits(a.code); });
          try { h = old.apply(this, arguments); } finally { Store.data.accounts = all; }
          var sel = "<div class=\"f\"><label for=\"fsAccCat\">Account type *</label><select id=\"fsAccCat\">" +
            CATS.map(function (x) { return "<option value=\"" + x[0] + "\"" + (x[0] === cat ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") +
            "</select><span class=\"hint\">Choose the kind of account first, then the account it goes under.</span></div>";
          return sel + h.replace("Belongs under *", "Goes under *");
        }
        if (f.k === "code") {
          return "<div class=\"f\"><label for=\"f_code\">Account code</label><input id=\"f_code\" value=\"" + String(v || "").replace(/"/g, "&quot;") + "\" readonly tabindex=\"-1\" placeholder=\"Filled in when you choose where it goes\"><span class=\"hint\">Given automatically as the next free number.</span></div>";
        }
        var out = old.apply(this, arguments);
        if (MORE.indexOf(f.k) >= 0) out = out.replace("<div class=\"f", "<div data-fsmore=\"1\" " + (open ? "" : "hidden ") + "class=\"f");
        if (f.k === "type") out = "<div class=\"f w\"><button type=\"button\" class=\"btn sm\" id=\"fsAccMore\">" + (open ? "Hide" : "More settings (copied from the account above)") + "</button></div>" + out;
        return out;
      };
    })(fieldHtml);

    document.addEventListener("change", function (e) {
      if (!e.target || e.target.id !== "fsAccCat" || !isNew()) return;
      cat = e.target.value; F.rec.parent = ""; F.rec.code = "";
      drawForm();
      var el = document.getElementById("f_parent"); if (el) el.focus();
    });
    document.addEventListener("click", function (e) {
      if (!e.target || e.target.id !== "fsAccMore") return;
      open = !open;
      document.querySelectorAll("[data-fsmore]").forEach(function (x) { x.hidden = !open; });
      e.target.textContent = open ? "Hide" : "More settings (copied from the account above)";
    });
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
