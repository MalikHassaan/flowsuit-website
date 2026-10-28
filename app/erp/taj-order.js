// TAJ dashboard: one numbered order for the slideshow and the PDF export (hassan, 2026-10-28). The order is an ERP
// setting (taj_order, sent in FS_TAJ.order) so everyone sees the same sequence. FS_ORDER sorts the dashboard's own
// lists (presOrder() for slides, PDF_ORDER through FS_KEEP); reports not in the saved order keep their place at the end.
// People with View and upload access get "Change the order" in the Present dialog and in the Export PDF panel.
(function () {
  var T = window.FS_TAJ || {}, O = T.order || [];
  window.FS_ORDER = function (list) {
    if (!O.length) return list;
    var pos = function (t) { var i = O.indexOf(t); return i < 0 ? 1e6 : i; };
    return list.map(function (t, i) { return [t, i]; }).sort(function (a, b) { return pos(a[0]) - pos(b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
  };
  if (!T.edit || !T.reports) return;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };

  function open() {
    var pd = document.getElementById("presDlg"); if (pd) pd.remove();
    var list = T.reports.slice(), d = document.createElement("div");
    d.className = "pdlg fs-ord"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Order of slides and PDF pages");
    function draw(focus) {
      d.innerHTML = '<div class="pdlg-in"><h3>Order of slides and PDF pages</h3>' +
        '<p class="note">Type a number to move a report to that place. The slideshow and the PDF export both follow this order, for everyone.</p><ol>' +
        list.map(function (r, i) { return '<li><input type="number" min="1" max="' + list.length + '" value="' + (i + 1) + '" data-i="' + i + '" aria-label="Place of ' + esc(r[1]) + '"><span>' + esc(r[1]) + "</span></li>"; }).join("") +
        '</ol><p class="note fs-ordmsg" role="status"></p><div class="exfoot"><button class="btn" type="button" data-a="save">Save order</button>' +
        '<button class="btn line" type="button" data-a="reset">Back to the standard order</button><button class="btn line" type="button" data-a="cancel">Cancel</button></div></div>';
      if (focus !== undefined) { var f = d.querySelector('input[data-i="' + focus + '"]'); if (f) { f.focus(); f.select(); } }
    }
    function move(i, to) {
      to = Math.max(1, Math.min(list.length, Math.round(to) || 1)) - 1;
      if (to === i) { draw(); return; }
      var x = list.splice(i, 1)[0]; list.splice(to, 0, x); draw(to);
    }
    function save(ids, msg) {
      var m = d.querySelector(".fs-ordmsg"); m.textContent = "Saving...";
      fetch(T.api + "/order", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": T.csrf }, body: JSON.stringify({ ids: ids }) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); m.textContent = msg; setTimeout(function () { location.reload(); }, 600); })
        .catch(function () { m.textContent = "Could not save the order. Reload the page and try again."; });
    }
    draw();
    document.body.appendChild(d);
    d.addEventListener("change", function (e) { var t = e.target; if (t.matches("input[data-i]")) move(+t.dataset.i, +t.value); });
    d.addEventListener("keydown", function (e) { var t = e.target; if (e.key === "Enter" && t.matches("input[data-i]")) { e.preventDefault(); move(+t.dataset.i, +t.value); } if (e.key === "Escape") d.remove(); });
    d.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-a]");
      if (e.target === d || (a && a.dataset.a === "cancel")) { d.remove(); return; }
      if (!a) return;
      if (a.dataset.a === "save") save(list.map(function (r) { return r[0]; }), "Saved. Reloading...");
      if (a.dataset.a === "reset") save([], "Standard order restored. Reloading...");
    });
  }

  function button() { var b = document.createElement("button"); b.type = "button"; b.className = "btn line small fs-ordbtn"; b.textContent = "Change the order"; b.addEventListener("click", open); return b; }
  function add() {
    var pd = document.getElementById("presDlg");
    if (pd && !pd.querySelector(".fs-ordbtn")) {
      var row = document.createElement("div"); row.className = "pdrow";
      row.innerHTML = '<span class="lbl">Order</span>'; row.appendChild(button());
      var foot = pd.querySelector(".exfoot"); if (foot) foot.parentNode.insertBefore(row, foot);
    }
    var ex = document.querySelector("#exportPanel .exhead");
    if (ex && !ex.querySelector(".fs-ordbtn")) ex.appendChild(button());
  }
  var css = document.createElement("style");
  css.textContent = ".fs-ord ol{list-style:none;margin:8px 0;padding:0;max-height:55vh;overflow:auto}.fs-ord li{display:flex;align-items:center;gap:10px;padding:4px 0;border-bottom:1px solid var(--line,#e2e8f0)}" +
    ".fs-ord li input{width:58px;padding:4px 6px;font:inherit;border:1px solid var(--line,#cbd5e1);border-radius:6px;background:var(--panel,#fff);color:var(--ink,#0f172a)}" +
    "#exportPanel .exhead{display:flex;align-items:center;justify-content:space-between;gap:10px}";
  document.head.appendChild(css);
  addEventListener("DOMContentLoaded", function () { add(); new MutationObserver(add).observe(document.body, { childList: true, subtree: true }); });
})();
