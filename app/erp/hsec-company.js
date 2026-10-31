// Company picker (hassan, 2026-10-31: "instead of showing ent 4, ent 5, ent 6 there should be + button to add company").
// Placeholder codes (ENT4, ENT5...) that have no name and no records are left out of "Select company", and an admin
// gets a "+ Add company" tile: type the company name, the short code is suggested from it, and saving takes over an
// unused placeholder code (so the placeholder goes away) or adds a new one. Settings stay admin-only on the server.
(function () {
  /* global Store, settings, legal, ENTS, openPicker, closePicker, setCompany, toast */
  var PH = /^ENT\d+$/i;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var ok = function () { return typeof Store !== "undefined" && Store.data && typeof settings === "function" && typeof ENTS === "function"; };
  var nameOf = function (e) { return typeof legal === "function" ? legal(e) : ((settings().legal || {})[e] || e); };

  function used(e) {
    var d = Store.data;
    return Object.keys(d).some(function (c) {
      return c !== "settings" && Array.isArray(d[c]) && d[c].some(function (r) { return r && r.entity === e; });
    });
  }
  // An unnamed placeholder nobody has used yet.
  var spare = function (e) { return PH.test(e) && nameOf(e) === e && !used(e); };

  function suggest(name) {
    var w = String(name).replace(/\(.*?\)/g, " ").replace(/\b(private|pvt|limited|ltd|llc|inc|co|company|the|and|of)\b\.?/gi, " ")
      .split(/[^A-Za-z0-9]+/).filter(Boolean);
    var c = w.length > 1 ? w.map(function (x) { return x[0]; }).join("") : (w[0] || "").slice(0, 5);
    return c.toUpperCase().slice(0, 8);
  }

  function tidy(pick) {
    if (!ok() || pick.dataset.fsCo) return;
    pick.dataset.fsCo = "1";
    var grid = pick.querySelector(".co-grid");
    if (!grid) return;
    var hid = 0;
    grid.querySelectorAll(".co-card[data-co]").forEach(function (b) {
      if (b.dataset.co !== "All" && spare(b.dataset.co)) { b.remove(); hid++; }
    });
    // The note about codes was only there because of the placeholders.
    if (hid && !ENTS().some(function (e) { return !spare(e) && nameOf(e) === e; })) {
      var note = pick.querySelector("p.note"); if (note) note.remove();
    }
    if (!window.FS_ADMIN) return;
    var add = document.createElement("div");
    add.className = "co-card fs-coadd";
    add.innerHTML = '<button type="button" class="fs-coplus" aria-label="Add company"><span class="pl">+</span><span class="cn">Add company</span><span class="cc">Name and short code</span></button>';
    var all = grid.querySelector('.co-card[data-co="All"]');
    grid.insertBefore(add, all);
  }

  function form(tile) {
    tile.classList.add("open");
    tile.innerHTML = '<span class="cn">New company</span>'
      + '<label>Company name<input id="fsCoName" maxlength="120" placeholder="e.g. Jaffer Brothers (Private) Limited" autocomplete="off"></label>'
      + '<label>Short code<input id="fsCoCode" maxlength="8" placeholder="e.g. JB" autocomplete="off"></label>'
      + '<span class="cc">The code is tagged on every record and cannot be changed later.</span>'
      + '<span class="fs-coerr" role="alert"></span>'
      + '<span class="fs-coact"><button type="button" class="btn pri" id="fsCoSave">Add company</button><button type="button" class="btn" id="fsCoCancel">Cancel</button></span>';
    var nm = tile.querySelector("#fsCoName"), cd = tile.querySelector("#fsCoCode");
    nm.addEventListener("input", function () { if (!cd.dataset.typed) cd.value = suggest(nm.value); });
    cd.addEventListener("input", function () { cd.dataset.typed = cd.value ? "1" : ""; cd.value = cd.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    nm.focus();
  }

  async function save(tile) {
    var err = tile.querySelector(".fs-coerr"), btn = tile.querySelector("#fsCoSave");
    var name = tile.querySelector("#fsCoName").value.trim(), code = tile.querySelector("#fsCoCode").value.trim().toUpperCase();
    var fail = function (m) { err.textContent = m; };
    if (!name) return fail("Type the company name.");
    if (!/^[A-Z0-9]{2,8}$/.test(code)) return fail("The short code needs 2 to 8 letters or numbers.");
    if (code === "ALL") return fail("ALL is reserved for the group view. Choose another code.");
    var s = settings(), ents = ENTS().slice(), lg = Object.assign({}, s.legal || {});
    if (ents.some(function (e) { return String(e).toUpperCase() === code; }) && !spare(code)) return fail(code + " is already a company code.");
    if (ents.some(function (e) { return nameOf(e).toLowerCase() === name.toLowerCase(); })) return fail("A company with this name already exists.");
    var slot = ents.findIndex(spare);
    if (ents.indexOf(code) >= 0) slot = ents.indexOf(code);
    if (slot >= 0) { delete lg[ents[slot]]; ents[slot] = code; } else ents.push(code);
    lg[code] = name;
    btn.disabled = true; fail("");
    try {
      await Store.save("settings", Object.assign({}, s, { id: "main", entities: ents, legal: lg }));
    } catch (x) {
      btn.disabled = false;
      return fail("Could not save. Only an admin can add a company.");
    }
    if (typeof toast === "function") toast(name + " added");
    if (typeof closePicker === "function") closePicker();
    if (typeof openPicker === "function") openPicker();
  }

  // Capture phase, so the app's own click handler never sees these buttons.
  addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(".fs-coadd button");
    if (!t) return;
    e.stopPropagation(); e.preventDefault();
    var tile = t.closest(".fs-coadd");
    if (t.classList.contains("fs-coplus")) form(tile);
    else if (t.id === "fsCoSave") save(tile);
    else if (t.id === "fsCoCancel") { tile.remove(); var p = document.getElementById("coPick"); if (p) { delete p.dataset.fsCo; tidy(p); } }
  }, true);
  addEventListener("keydown", function (e) {
    var tile = e.target.closest && e.target.closest(".fs-coadd");
    if (!tile) return;
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); save(tile); }
  }, true);

  function watch() {
    if (!document.body) return setTimeout(watch, 50);
    new MutationObserver(function () {
      var p = document.getElementById("coPick");
      if (p) try { tidy(p); } catch (x) { /* never break the picker */ }
    }).observe(document.body, { childList: true });
  }
  watch();

  var css = document.createElement("style");
  css.textContent = ".fs-coadd{border-style:dashed;padding:0;justify-content:center}"
    + ".fs-coadd .fs-coplus{all:unset;box-sizing:border-box;width:100%;height:100%;min-height:96px;padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-align:center}"
    + ".fs-coadd .pl{font-size:30px;line-height:1;color:var(--accent,#1F6FB8);font-weight:300}"
    + ".fs-coadd:hover{border-left-color:var(--accent,#1F6FB8)}"
    + ".fs-coadd.open{padding:12px 14px;cursor:default;gap:6px;justify-content:flex-start}"
    + ".fs-coadd label{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted)}"
    + ".fs-coadd input{font:inherit;font-size:14px;padding:5px 7px;border:1px solid var(--line);color:var(--ink);background:var(--panel)}"
    + ".fs-coerr{color:#b42318;font-size:12px}.fs-coerr:empty{display:none}"
    + ".fs-coact{display:flex;gap:6px;margin-top:4px}";
  (document.head || document.documentElement).appendChild(css);
})();
