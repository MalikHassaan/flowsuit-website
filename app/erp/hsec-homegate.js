// Home access (hassan, 2026-11-01: "add home access button in user access, to whom it should be shown and to whom it
// should not"). Users and access already lists Home, but the app falls back to Home whenever someone opens an area
// they may not see, so Home's company figures (bank balances, receivables, payables) still showed to everyone.
// When a person's areas (window.FS_MODS) leave Home unticked, the Home page shows only a list of the areas they can
// open; nothing else on it is drawn.
(function () {
  /* global dashboard, navTree, render, esc, ME */
  if (!Array.isArray(window.FS_MODS) || window.FS_MODS.indexOf("dashboard") >= 0) return;
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var e = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };

  function landing() {
    var groups = safe(function () { return navTree(); }, []) || [];
    var cards = groups.map(function (g) {
      var items = g.items || [].concat.apply([], (g.subs || []).map(function (u) { return u.items || []; }));
      items = items.filter(function (i) { return i[0] !== "dashboard"; });
      if (!items.length) return "";
      return '<div class="fshg-card"><h4>' + e(g.name) + "</h4>" + items.map(function (i) {
        return '<a href="#' + e(i[0]) + '">' + e(i[1]) + "</a>";
      }).join("") + "</div>";
    }).join("");
    var who = safe(function () { return localStorage.getItem("hsec-erp-name"); }, "") || "";
    return '<div class="fshg"><h2>Welcome' + (who ? ", " + e(who) : "") + "</h2>"
      + '<p class="muted">These are the areas you can open. Pick one to start.</p>'
      + (cards ? '<div class="fshg-grid">' + cards + "</div>"
        : '<div class="panel empty"><b>No areas yet</b>Ask your administrator to give you access in Users and access.</div>')
      + "</div>";
  }

  function hook() {
    if (typeof dashboard !== "function" || typeof navTree !== "function") return false;
    dashboard = function () { return landing(); }; // eslint-disable-line no-global-assign
    if (typeof render === "function") safe(render);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fshg h2{margin:4px 0 4px}.fshg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:14px}"
    + ".fshg-card{border:1px solid var(--line,#e2e8f0);border-radius:10px;padding:12px 14px;background:var(--panel,#fff)}"
    + ".fshg-card h4{margin:0 0 8px;font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted,#64748b)}"
    + ".fshg-card a{display:block;padding:5px 0;font-weight:600;text-decoration:none}.fshg-card a:hover{text-decoration:underline}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
