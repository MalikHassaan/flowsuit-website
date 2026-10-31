// Receive payment: the customer is picked, not typed (hassan, 2026-10-31: "in RV make the field customer uneditable, only
// drop down list if any project is listed, and give + button also so that we can add customer directly"). The app's
// "Customer (project)" box (#rcCust, a free-text box with suggestions) becomes a drop-down of the same names (projects,
// customers already in the ledger or on invoices), and + adds a new customer: an admin's is saved for everyone, anyone
// else's stays in the list once a receipt for it is posted. The app reads #rcCust the same way, so nothing else changes.
(function () {
  /* global V, Store, settings, toast */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var key = function (s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); };
  var extra = [];
  var saved = function () { try { var x = settings().rvCustomers; return Array.isArray(x) ? x : []; } catch (e) { return []; } };

  function swap() {
    var inp = document.getElementById("rcCust");
    if (!inp || inp.tagName !== "INPUT") return;
    var dl = document.getElementById("rcCustL"), names = [], seen = {}, cur = inp.value.trim();
    var add = function (v, label) { var k = key(v); if (!v || seen[k]) return; seen[k] = 1; names.push([v, label || ""]); };
    if (dl) dl.querySelectorAll("option").forEach(function (o) { add(o.value, o.textContent.trim()); });
    saved().concat(extra).forEach(function (v) { add(v); });
    add(cur);
    var sel = document.createElement("select");
    sel.id = "rcCust";
    sel.innerHTML = "<option value=\"\">Choose the customer…</option>" + names.map(function (x) {
      return "<option value=\"" + esc(x[0]) + "\"" + (key(x[0]) === key(cur) ? " selected" : "") + ">" + esc(x[0]) + (x[1] ? " · " + esc(x[1]) : "") + "</option>";
    }).join("");
    inp.replaceWith(sel);
    if (dl) dl.remove();
    var lab = document.querySelector("label[for=rcCust]");
    if (lab && !lab.querySelector(".fs-rvplus")) {
      lab.classList.add("fs-rvlab");
      lab.insertAdjacentHTML("beforeend", "<button type=\"button\" class=\"fs-rvplus\" id=\"fsRvAdd\" title=\"Add a customer\" aria-label=\"Add a customer\">+</button>");
      sel.insertAdjacentHTML("afterend", "<span class=\"fs-rvnew\" hidden><input id=\"fsRvNew\" maxlength=\"80\" placeholder=\"New customer name\" autocomplete=\"off\"><button type=\"button\" class=\"btn pri\" id=\"fsRvOk\">Add</button><button type=\"button\" class=\"btn\" id=\"fsRvNo\">Cancel</button></span>");
    }
  }

  function addBtn(id) {
    var box = document.querySelector(".fs-rvnew"), sel = document.getElementById("rcCust"), inp = document.getElementById("fsRvNew");
    if (!box || !sel) return;
    if (id === "fsRvAdd") { box.hidden = false; sel.hidden = true; inp.value = ""; inp.focus(); return; }
    box.hidden = true; sel.hidden = false;
    if (id === "fsRvNo") return;
    var name = inp.value.replace(/\s+/g, " ").trim().slice(0, 80); if (!name) return;
    var have = [].slice.call(sel.options).find(function (o) { return o.value && key(o.value) === key(name); });
    if (!have) {
      extra.push(name);
      have = document.createElement("option"); have.value = name; have.textContent = name; sel.appendChild(have);
      if (window.FS_ADMIN && typeof settings === "function" && typeof Store !== "undefined") {
        var s = settings();
        Store.save("settings", Object.assign({}, s, { id: "main", rvCustomers: saved().concat([name]) }))
          .then(function () { if (typeof toast === "function") toast(name + " added to the customer list"); }, function () {});
      }
    }
    sel.value = have.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }

  addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#fsRvAdd, #fsRvOk, #fsRvNo");
    if (!b) return;
    e.preventDefault(); e.stopPropagation(); addBtn(b.id);
  }, true);
  addEventListener("keydown", function (e) {
    if (!e.target || e.target.id !== "fsRvNew") return;
    if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); addBtn(e.key === "Enter" ? "fsRvOk" : "fsRvNo"); }
  }, true);

  function start() {
    if (!document.body) return setTimeout(start, 50);
    new MutationObserver(function () { try { swap(); } catch (x) { /* never break the page */ } }).observe(document.body, { childList: true, subtree: true });
    var css = document.createElement("style");
    css.textContent = ".fs-rvlab{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".fs-rvplus{width:26px;height:26px;padding:0;border:1px solid #16a34a;border-radius:6px;background:#ecfdf3;color:#15803d;font-size:18px;line-height:1;cursor:pointer}" +
      ".fs-rvplus:hover{background:#16a34a;color:#fff}.fs-rvnew{display:flex;gap:6px}.fs-rvnew[hidden]{display:none}.fs-rvnew input{flex:1;min-width:0}";
    document.head.appendChild(css);
  }
  start();
})();
