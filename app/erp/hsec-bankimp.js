// Banks: import the company bank list from Excel (hassan, 2026-11-20: "upload all the banks with the bank initial and
// last 3 digits of the bank company wise in to the ERP and other than that exclude the bank with BANK1 BANK 2 etc").
// Treasury › Bank accounts & facilities gets "Import bank list (Excel)". The sheet needs a company column and a bank
// account number column (bank name, IBAN, branch, address and city are read when present). Each row becomes a bank account
// in its company named by the bank's initials and the account's last 3 digits (JSBL-464), with its own ledger sub account
// under 1210. Rows already in the ERP (same account number or IBAN) are skipped. Placeholder banks named Bank 1, Bank 2 ...
// are hidden from every pick list when nothing is posted to them; ones with entries are listed and kept.
// Nothing is saved until the button under the preview is pressed. The bank list itself never goes into the code.
(function () {
  /* global S, V, Store, listView, render, toast, esc, tbLib, ENTS, coName, nextCode, addAccount, inheritFrom, accByCode */
  var plan = null, busy = false;
  var str = function (v) { return v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim(); };
  var digits = function (v) { return str(v).replace(/\D/g, ""); };
  // the short names banks in Pakistan go by
  var ABBR = [[/alfalah.*islamic|islamic.*alfalah/, "BAFL-I"], [/alfalah/, "BAFL"], [/\bjs\b|js bank/, "JSBL"], [/askari/, "AKBL"], [/\bmcb\b|muslim commercial/, "MCB"],
    [/al.?habib/, "BAHL"], [/meezan/, "MBL"], [/makramah|\bbml\b|summit/, "BML"], [/national bank|\bnbp\b/, "NBP"], [/khyber/, "BOK"], [/bank of punjab|\bbop\b/, "BOP"],
    [/habib metro/, "HMB"], [/\bhbl\b|habib bank/, "HBL"], [/\bubl\b|united bank/, "UBL"], [/allied|\babl\b/, "ABL"], [/faysal/, "FBL"], [/soneri/, "SNBL"],
    [/standard chartered/, "SCB"], [/dubai islamic/, "DIB"], [/bankislami/, "BIPL"], [/silk/, "SILK"], [/sindh/, "SNDB"], [/first women/, "FWBL"], [/zarai|\bztbl\b/, "ZTBL"]];
  function abbr(name, iban) {
    var t = str(name).toLowerCase();
    for (var i = 0; i < ABBR.length; i++) if (ABBR[i][0].test(t)) return ABBR[i][1];
    var ib = str(iban).replace(/\s/g, "").toUpperCase().match(/^PK\d\d([A-Z]{4})/);
    if (ib) return ib[1];
    return t.replace(/\b(bank|limited|ltd|the|of|pvt|private)\b/g, " ").split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join("").toUpperCase().slice(0, 5) || "BANK";
  }
  var norm = function (s) { return str(s).toLowerCase().replace(/\b(private|pvt|limited|limted|ltd|company|co|the|\(pvt\.?\)|\(private\))\b/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); };
  function ents() { try { return ENTS().filter(function (e) { return !/^ENT\d$/.test(e) || coName(e) !== e; }); } catch (x) { return []; } }
  function lev(a, b) { var d = [], i, j; for (i = 0; i <= a.length; i++) d[i] = [i]; for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
  function entOf(company) {
    var c = norm(company); if (!c) return "";
    var E = ents(), hit = E.filter(function (e) { return norm(coName(e)) === c || norm(e) === c; });
    if (hit.length === 1) return hit[0];
    // "Hong Kong Shanghai Electric" vs "Honk Kong Shenghai Electric": compare words that match closely
    var words = function (s) { return s.split(" ").filter(function (w) { return w.length > 2; }); }, cw = words(c);
    var score = function (e) { var ew = words(norm(coName(e))); if (!ew.length) return 0; var m = 0; cw.forEach(function (w) { if (ew.some(function (x) { return x === w || (x.length > 3 && w.length > 3 && lev(x, w) <= (w.length > 6 ? 2 : 1)); })) m++; }); return m / Math.max(cw.length, ew.length); };
    var best = E.map(function (e) { return [e, score(e)]; }).sort(function (a, b) { return b[1] - a[1]; });
    return best.length && best[0][1] >= 0.75 && (!best[1] || best[1][1] < best[0][1]) ? best[0][0] : "";
  }
  function header(rows) {
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var t = (rows[i] || []).map(function (c) { return str(c).toLowerCase(); }), find = function (re) { for (var k = 0; k < t.length; k++) if (t[k].length < 60 && re.test(t[k])) return k; return -1; };
      var c = { co: find(/compan|entity/), acc: find(/account no|account number|^a\/c|acc(ount)? #/), bank: find(/^(bank )?name$|^bank$/), iban: find(/^iban/), br: find(/branch no|branch code/), addr: find(/^address|branch name/), city: find(/^city/), type: find(/^type|account type/) };
      if (c.co >= 0 && (c.acc >= 0 || c.iban >= 0)) return { row: i, c: c };
    }
    return null;
  }
  var placeRe = /^\s*bank\s*-?\s*\d+\b/i;
  function postings(accId) { var k = 0; (Store.data.journals || []).forEach(function (j) { (j.lines || []).forEach(function (l) { if (l.account === accId && (+l.debit || +l.credit)) k++; }); }); return k; }
  function placeholders() {
    var out = [];
    (Store.data.accounts || []).forEach(function (a) {
      if (!/^1210/.test(String(a.code)) || a.posting === "Header" || !placeRe.test(a.name || "")) return;
      out.push({ acc: a, n: postings(a.id), bank: (Store.data.banks || []).find(function (b) { return b.glAcc === a.id; }) || null, hidden: a.hidden === "Yes" });
    });
    (Store.data.banks || []).forEach(function (b) { if (placeRe.test(b.bank || "") && !out.some(function (p) { return p.bank === b; })) out.push({ acc: null, n: b.glAcc ? postings(b.glAcc) : 0, bank: b, hidden: false }); });
    return out;
  }
  function read(rows) {
    var h = header(rows); if (!h) return { err: "No Company column and Bank Account No. (or IBAN) column found in the first rows of the first sheet." };
    var have = Store.data.banks || [], out = [];
    rows.slice(h.row + 1).forEach(function (r) {
      r = r || []; var g = function (k) { return k >= 0 ? str(r[k]) : ""; };
      var co = g(h.c.co), acc = g(h.c.acc), iban = g(h.c.iban).replace(/\s+/g, ""), bank = g(h.c.bank);
      if (!co || (!digits(acc) && !iban)) return;
      var d = digits(acc) || digits(iban), short = abbr(bank, iban) + "-" + d.slice(-3);
      var dup = have.find(function (b) { var bd = digits(b.account), bi = str(b.iban).replace(/\s+/g, "").toUpperCase(); return (bd && bd.length >= 6 && (bd === d || bd.slice(-10) === d.slice(-10))) || (iban && bi && bi === iban.toUpperCase()) || (iban && digits(b.account) && iban.toUpperCase().indexOf(digits(b.account)) >= 0 && digits(b.account).length >= 7); });
      out.push({ co: co, ent: entOf(co), bank: bank, short: short, acc: acc, iban: iban, br: g(h.c.br), addr: [g(h.c.addr), g(h.c.city)].filter(Boolean).join(", "), type: /saving/i.test(g(h.c.type)) ? "Savings" : "Current", dup: dup ? dup.bank : "" });
    });
    if (!out.length) return { err: "No bank rows with a company and an account number were found." };
    // two accounts of the same bank ending in the same 3 digits in one company: add one more digit
    out.forEach(function (x) { var same = out.filter(function (y) { return y !== x && y.ent === x.ent && y.short === x.short; }); if (same.length) { var d = digits(x.acc) || digits(x.iban); x.short = x.short.replace(/-\d+$/, "-" + d.slice(-4)); } });
    return { rows: out, hide: true };
  }
  function panel() {
    var h = "<div class=\"panel fs-bi\"><div class=\"fs-bibar\"><b>Import bank list</b><span class=\"muted\">Excel with Company, Bank name, Bank Account No. and IBAN columns. Each account is named by the bank's initials and its last 3 digits, e.g. JSBL-464.</span>" +
      "<label class=\"btn sm\">Choose Excel file<input type=\"file\" id=\"fsBiFile\" accept=\".xlsx,.xls,.csv\" hidden></label>" + (plan ? "<button type=\"button\" class=\"btn sm\" id=\"fsBiX\">Close</button>" : "") + "</div>";
    if (!plan) return h + "</div>";
    if (plan.err) return h + "<p class=\"err\">" + esc(plan.err) + "</p></div>";
    if (plan.done) return h + "<p class=\"fs-biok\">" + esc(plan.done) + "</p></div>";
    var E = ents(), opt = function (v) { return "<option value=\"\">Skip (company not in the ERP)</option>" + E.map(function (e) { return "<option value=\"" + esc(e) + "\"" + (e === v ? " selected" : "") + ">" + esc(coName(e)) + " (" + esc(e) + ")</option>"; }).join(""); };
    var add = plan.rows.filter(function (x) { return x.ent && !x.dup; }).length;
    h += "<div class=\"tw\"><table><thead><tr><th>Name in ERP</th><th>Bank</th><th>Account no. / IBAN</th><th>Company in the sheet</th><th>ERP company</th><th>Result</th></tr></thead><tbody>" +
      plan.rows.map(function (x, i) {
        return "<tr><td><b class=\"mono\">" + esc(x.short) + "</b></td><td>" + esc(x.bank) + (x.addr ? "<br><span class=\"muted\">" + esc(x.addr) + "</span>" : "") + "</td><td class=\"mono\">" + esc(x.acc) + (x.iban ? "<br><span class=\"muted\">" + esc(x.iban) + "</span>" : "") + "</td><td>" + esc(x.co) + "</td>" +
          "<td><select data-bient=\"" + i + "\">" + opt(x.ent) + "</select></td><td>" + (x.dup ? "<span class=\"muted\">Already in the ERP as " + esc(x.dup) + ", skipped</span>" : x.ent ? "Added, with ledger account under 1210" : "<span class=\"fs-biwarn\">Skipped: choose the company</span>") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    var P = placeholders(), hideable = P.filter(function (p) { return !p.n && !p.hidden; }), kept = P.filter(function (p) { return p.n; });
    h += "<div class=\"fs-biph\"><label><input type=\"checkbox\" id=\"fsBiHide\"" + (plan.hide ? " checked" : "") + "> Hide the placeholder banks (Bank 1, Bank 2 …) from every list</label>" +
      (hideable.length ? "<div class=\"muted\">Hidden: " + hideable.map(function (p) { return esc(p.acc ? p.acc.code + " " + p.acc.name + (p.acc.entity ? " (" + p.acc.entity + ")" : "") : p.bank.bank + " (" + (p.bank.entity || "") + ")"); }).join("; ") + "</div>" : "<div class=\"muted\">No unused placeholder banks found.</div>") +
      (kept.length ? "<div class=\"fs-biwarn\">Kept, because vouchers are posted to them: " + kept.map(function (p) { return esc((p.acc ? p.acc.code + " " + p.acc.name : p.bank.bank) + " – " + p.n + " entr" + (p.n === 1 ? "y" : "ies")); }).join("; ") + ". Move those entries to the right bank first (reverse and correct), then hide it under Chart of accounts › Show in pick lists.</div>" : "") + "</div>";
    h += "<div class=\"fs-bibtn\"><button type=\"button\" class=\"btn pri\" id=\"fsBiGo\"" + (busy ? " disabled" : "") + ">" + (busy ? "Importing…" : "Import " + add + " bank account" + (add === 1 ? "" : "s")) + "</button><span class=\"muted\">Statement balances stay empty; enter them on each bank, or reconcile.</span></div>";
    return h + "</div>";
  }
  async function create() {
    if (!plan || !plan.rows || busy) return;
    busy = true; render();
    var made = 0, hid = 0, errs = [];
    var par = accByCode()["1210"];
    for (var i = 0; i < plan.rows.length; i++) {
      var x = plan.rows[i]; if (!x.ent || x.dup) continue;
      try {
        if (!par) throw new Error("main account 1210 is missing from the chart of accounts");
        var code = nextCode("1210"); if (!code) throw new Error("1210 has no free sub account codes");
        var gl = await addAccount(Object.assign(inheritFrom(par), { code: code, name: x.short, parent: "1210", posting: "Posting", entity: x.ent, bankName: x.bank, bankAccNo: x.acc }), "Bank list import");
        await Store.save("banks", { bank: x.short, account: x.acc, iban: x.iban, bankName: x.bank, branchCode: x.br, branch: x.addr, entity: x.ent, type: x.type, glAcc: gl || ("a" + code), importedOn: new Date().toISOString().slice(0, 10) });
        x.dup = x.short; made++;
      } catch (er) { errs.push(x.short + ": " + ((er && er.message) || er)); }
    }
    if (plan.hide) {
      var P = placeholders();
      for (var k = 0; k < P.length; k++) {
        var p = P[k]; if (p.n) continue;
        try {
          if (p.acc && !p.hidden) { await Store.save("accounts", Object.assign({}, p.acc, { hidden: "Yes" })); p.acc.hidden = "Yes"; hid++; }
          if (p.bank && !p.bank.hiddenPh) { await Store.save("banks", Object.assign({}, p.bank, { hiddenPh: "Yes", type: p.bank.type || "Current" })); p.bank.hiddenPh = "Yes"; if (!p.acc) hid++; }
        } catch (er) { errs.push((p.acc ? p.acc.name : p.bank.bank) + ": " + ((er && er.message) || er)); }
      }
    }
    busy = false;
    plan = { done: made + " bank account" + (made === 1 ? "" : "s") + " added" + (hid ? ", " + hid + " placeholder bank" + (hid === 1 ? "" : "s") + " hidden" : "") + "." + (errs.length ? " Not done: " + errs.join("; ") + "." : "") };
    toast(plan.done); render();
  }
  function css() {
    var s = document.createElement("style");
    s.textContent = ".fs-bi{margin:0 0 14px;padding:12px}.fs-bibar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}.fs-bibar .muted{flex:1 1 300px;font-size:12px}" +
      ".fs-bi table{margin-top:10px}.fs-bi select{max-width:260px}.fs-biwarn{color:#b45309;font-weight:600}.fs-biok{color:#15803d;font-weight:600;margin:10px 0 0}" +
      ".fs-biph{margin:12px 0 0;padding:10px 12px;border:1px solid var(--line,#e3e6eb);border-radius:10px;font-size:13px}.fs-biph div{margin-top:4px}.fs-bibtn{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap}" +
      "tr.fs-biphrow{display:none}";
    document.head.appendChild(s);
  }
  function hook() {
    if (typeof listView !== "function" || typeof S === "undefined" || !S.banks || typeof tbLib !== "function" || typeof addAccount !== "function" || typeof nextCode !== "function") return false;
    var old = listView;
    listView = function (c) { // eslint-disable-line no-global-assign
      if (c !== "banks") return old.apply(this, arguments);
      // placeholder banks hidden by the import stay out of the register
      var all = Store.data.banks, h;
      if (Array.isArray(all)) { Store.data.banks = all.filter(function (b) { return b.hiddenPh !== "Yes"; }); try { h = old.apply(this, arguments); } finally { Store.data.banks = all; } }
      else h = old.apply(this, arguments);
      var admin = !window.FS_BRIDGE || (FS_BRIDGE.edit !== false);
      return admin && typeof h === "string" ? panel() + h : h;
    };
    document.addEventListener("change", async function (e) {
      var t = e.target; if (!t) return;
      if (t.id === "fsBiHide" && plan) { plan.hide = t.checked; return; }
      if (t.hasAttribute && t.hasAttribute("data-bient") && plan && plan.rows) { var x = plan.rows[+t.getAttribute("data-bient")]; if (x) { x.ent = t.value; render(); } return; }
      if (t.id !== "fsBiFile" || !t.files[0]) return;
      try {
        var X = await tbLib(), wb = X.read(await t.files[0].arrayBuffer(), { type: "array" });
        plan = read(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" }));
      } catch (er) { plan = { err: (er && er.message) || "Could not read the file." }; }
      render();
    });
    document.addEventListener("click", function (e) {
      var t = e.target; if (!t) return;
      if (t.id === "fsBiGo") { e.preventDefault(); create(); }
      if (t.id === "fsBiX") { e.preventDefault(); plan = null; render(); }
    });
    css();
    if (/banks/.test(location.hash) && typeof render === "function") render();
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
