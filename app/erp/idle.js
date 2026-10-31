// Sign out after 10 minutes without activity (hassan, 2026-10-31). Any mouse, keyboard, scroll or touch in any open ERP
// tab counts (tabs share the last activity time through localStorage), and so does a call in progress. While the person
// is active the server is pinged at most once a minute, so typing a long voucher never loses the session. One minute
// before the end a notice counts down; any movement keeps working. At zero every tab goes to /erp/timeout.
(function () {
  var C = window.FS_IDLE;
  if (!C || window.__fsIdle) return;
  window.__fsIdle = 1;
  var KEY = "fs-erp-active-" + (C.slot || 1), LIMIT = C.limit * 1000, WARN = 60000;
  var mine = Date.now(), pinged = Date.now(), box = null, gone = false;
  var shared = function () { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } };
  var mark = function (t) { mine = t; try { localStorage.setItem(KEY, String(t)); } catch (e) { /* private window */ } };
  mark(Date.now());

  function out() {
    if (gone) return;
    gone = true;
    location.href = C.out;
  }
  function ping() {
    pinged = Date.now();
    fetch(C.ping, { credentials: "same-origin", cache: "no-store" }).then(function (r) { if (r.status === 401) out(); }, function () { /* offline: try again on the next activity */ });
  }
  function active() {
    var n = Date.now();
    if (n - mine < 1500) return;
    mark(n);
    hide();
    if (n - pinged > 60000) ping();
  }
  ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll", "input"].forEach(function (e) {
    addEventListener(e, active, { capture: true, passive: true });
  });
  // A voice or video call counts as activity even when nobody touches the mouse.
  function inCall() {
    return [].some.call(document.querySelectorAll("audio, video"), function (m) { return m.srcObject && !m.paused; });
  }

  function show(left) {
    if (!box) {
      box = document.createElement("div");
      box.id = "fsIdle";
      box.setAttribute("role", "alertdialog");
      box.innerHTML = "<div><b>Still there?</b><p>You will be signed out in <span></span> seconds because there has been no activity for a while.</p><button type=\"button\">Keep me signed in</button></div>";
      box.querySelector("button").addEventListener("click", function () { mine = 0; active(); });
      var css = document.createElement("style");
      css.textContent = "#fsIdle{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;background:rgba(15,23,42,.45);font:15px/1.45 Inter,system-ui,sans-serif}" +
        "#fsIdle>div{background:#fff;color:#0f172a;border-radius:14px;padding:22px 24px;max-width:360px;box-shadow:0 30px 70px rgba(2,6,23,.4);text-align:center}" +
        "#fsIdle b{font-size:18px}#fsIdle p{margin:8px 0 14px;color:#475569}#fsIdle span{font-weight:700;color:#b91c1c}" +
        "#fsIdle button{border:0;border-radius:9px;padding:9px 16px;background:#1F6FB8;color:#fff;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}";
      box.appendChild(css);
      document.body.appendChild(box);
    }
    box.querySelector("span").textContent = Math.ceil(left / 1000);
  }
  function hide() { if (box) { box.remove(); box = null; } }

  setInterval(function () {
    if (gone) return;
    if (inCall()) { mine = 0; active(); return; }
    var left = LIMIT - (Date.now() - Math.max(shared(), mine));
    if (left <= 0) out();
    else if (left <= WARN) show(left);
    else hide();
  }, 1000);
})();
