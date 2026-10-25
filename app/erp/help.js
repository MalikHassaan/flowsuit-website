// "Ask for help" (window.FS_HELP): a round ? button next to the chat button. It answers questions about using this
// system only. With each question it sends the system's menu, its own guide and the labels on the current screen
// (headings, buttons, tabs, column names) so the steps match what the person sees. Figures in tables are never sent.
(function () {
  var C = window.FS_HELP;
  if (!C || window.__fsHelp) return;
  window.__fsHelp = true;
  var KEY = "fs-help-" + C.system, msgs = [], root, panel, list, input, busy = false;
  try { msgs = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch (x) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>"); }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20))); } catch (x) {} }
  function txt(el) { return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(); }
  function uniq(a) { var seen = {}; return a.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  function inUi(el) { return el.closest && el.closest("#fs-help,#fs-chat,#fs-att,#fs-call,#fs-intro"); }

  // ---- What the assistant gets to know about this system ----
  function menu() {
    var out = [];
    // HSEC: the app's own menu, screen descriptions and go-live guide.
    try {
      /* global NAV, MODS, GL */
      if (typeof NAV !== "undefined" && Array.isArray(NAV)) {
        NAV.forEach(function (g) {
          out.push(g[0] + ": " + g[1].map(function (i) {
            var m = typeof MODS !== "undefined" && MODS[i[0]], tabs = m && m.tabs ? " (tabs: " + m.tabs.map(function (t) { return t[1]; }).join(", ") + ")" : "";
            return i[1] + tabs;
          }).join("; "));
        });
        return out.join("\n");
      }
    } catch (x) {}
    // Anything else: the side menu as shown.
    document.querySelectorAll("nav, aside, [role=navigation]").forEach(function (n) {
      if (inUi(n)) return;
      var items = uniq([].map.call(n.querySelectorAll("a, button, .nav-g, .nav-i, summary, h2, h3"), txt)).filter(function (t) { return t.length < 60; });
      if (items.length) out.push(items.join(" · "));
    });
    return uniq(out).join("\n");
  }
  function guide() {
    var out = [];
    try {
      if (typeof MODS !== "undefined") {
        Object.keys(MODS).forEach(function (k) { if (MODS[k] && MODS[k].sub) out.push("- " + (k === "dashboard" ? "Home" : k) + ": " + MODS[k].sub); });
      }
      if (typeof NAV !== "undefined") {
        var names = {};
        NAV.forEach(function (g) { g[1].forEach(function (i) { names[i[0]] = i[1]; }); });
        out = out.map(function (l) { return l.replace(/^- (\w+):/, function (a, k) { return "- " + (names[k] || k) + ":"; }); });
      }
      if (typeof GL === "function") {
        out.push("\nGo-live steps (Home > Start here), in order:");
        GL().forEach(function (s, i) { out.push((i + 1) + ". " + s[1] + ": " + s[2]); });
      }
    } catch (x) {}
    return out.join("\n");
  }
  // The screen: headings, tabs, buttons, field names and column names. Never table cells or amounts.
  function screen() {
    var parts = [];
    var main = document.querySelector("main, .app, #app, .content") || document.body;
    var hs = uniq([].map.call(main.querySelectorAll("h1, h2, h3, h4, legend"), txt)).filter(function (t) { return t.length < 90; });
    if (hs.length) parts.push("Headings: " + hs.slice(0, 25).join(" | "));
    var on = uniq([].map.call(document.querySelectorAll(".is-on, .active, [aria-selected=true], [aria-current]"), txt)).filter(function (t) { return t && t.length < 50; });
    if (on.length) parts.push("Selected: " + on.slice(0, 8).join(" | "));
    var btn = uniq([].map.call(main.querySelectorAll("button, a.btn, [role=tab], input[type=submit]"), function (b) { return inUi(b) ? "" : txt(b) || b.value || b.title || ""; }))
      .filter(function (t) { return t.length > 1 && t.length < 40 && !/^[\d.,\s%-]+$/.test(t); });
    if (btn.length) parts.push("Buttons and tabs: " + btn.slice(0, 50).join(" | "));
    var fields = uniq([].map.call(main.querySelectorAll("label, th"), function (l) { return inUi(l) ? "" : txt(l).slice(0, 40); }))
      .filter(function (t) { return t && !/^[\d.,\s%-]+$/.test(t); });
    if (fields.length) parts.push("Fields and columns: " + fields.slice(0, 60).join(" | "));
    try { if (typeof V !== "undefined" && V.mod) parts.unshift("Open module: " + V.mod + (V.tab && V.tab[V.mod] ? ", tab " + V.tab[V.mod] : "")); } catch (x) {}
    parts.unshift("Page: " + document.title + " (" + location.pathname + location.hash + ")");
    return parts.join("\n");
  }

  // ---- The window ----
  function build() {
    root = document.createElement("div");
    root.id = "fs-help";
    root.innerHTML = '<button type="button" class="fsh-fab" title="Ask for help with ' + esc(C.name) + '" aria-label="Ask for help">?</button>'
      + '<section class="fsh-panel" hidden role="dialog" aria-label="Help"><header><div><b>Ask for help</b><small>' + esc(C.name) + ' assistant</small></div>'
      + '<button type="button" data-h="clear" title="New conversation">↺</button><button type="button" data-h="close" aria-label="Close">&#215;</button></header>'
      + '<div class="fsh-list"></div><div class="fsh-compose"><textarea rows="1" maxlength="1000" placeholder="How do I…"></textarea><button type="button" data-h="send" aria-label="Send">➤</button></div></section>';
    document.body.appendChild(root);
    panel = root.querySelector(".fsh-panel");
    list = root.querySelector(".fsh-list");
    input = root.querySelector("textarea");
    ["keydown", "keyup", "keypress"].forEach(function (t) { root.addEventListener(t, function (e) { e.stopPropagation(); }); });
    root.querySelector(".fsh-fab").addEventListener("click", function () { toggle(panel.hidden); });
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-h]");
      if (!b) return;
      var h = b.getAttribute("data-h");
      if (h === "close") toggle(false);
      if (h === "send") ask();
      if (h === "clear") { msgs = []; save(); draw(); }
      if (h === "q") { input.value = b.textContent; ask(); }
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
      if (e.key === "Escape") toggle(false);
    });
    input.addEventListener("input", function () { input.style.height = "auto"; input.style.height = Math.min(110, input.scrollHeight) + "px"; });
  }
  function toggle(on) {
    panel.hidden = !on;
    root.classList.toggle("is-open", on);
    if (on) { draw(); input.focus(); }
  }
  var STARTERS = {
    hsec: ["How do I post a journal voucher?", "How do I enter and pay a supplier bill?", "How do I see the trial balance for one company?", "What should I set up first?"],
    taj: ["How do I record a customer's instalment receipt?", "How do I see overdue instalments?", "How do I present the recovery report?"],
    erp: ["How do I check in from a site?", "How do I ask for leave?", "How do I start a video call?"]
  };
  function draw() {
    var h = '<p class="fsh-hi">Ask me how to do anything in <b>' + esc(C.name) + '</b>. I explain the steps; I cannot see or change your records.</p>';
    if (!msgs.length) h += '<div class="fsh-qs">' + (STARTERS[C.system] || []).map(function (q) { return '<button type="button" data-h="q">' + esc(q) + "</button>"; }).join("") + "</div>";
    msgs.forEach(function (m) { h += '<div class="fsh-msg is-' + m.role + '">' + (m.role === "user" ? esc(m.content).replace(/\n/g, "<br>") : fmt(m.content)) + "</div>"; });
    if (busy) h += '<div class="fsh-msg is-assistant fsh-dots"><i></i><i></i><i></i></div>';
    list.innerHTML = h;
    list.scrollTop = list.scrollHeight;
  }
  function ask() {
    var q = input.value.trim();
    if (!q || busy) return;
    input.value = "";
    input.style.height = "auto";
    msgs.push({ role: "user", content: q });
    busy = true;
    draw();
    fetch(C.api, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": C.csrf },
      body: JSON.stringify({ system: C.system, messages: msgs.slice(-12), ctx: { menu: menu(), guide: guide(), screen: screen() } })
    }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (j) {
      msgs.push({ role: "assistant", content: j.reply || j.error || "Sorry, something went wrong. Try again." });
    }, function () {
      msgs.push({ role: "assistant", content: "No connection. Check your internet and try again." });
    }).then(function () { busy = false; save(); draw(); });
  }
  function start() {
    if (!document.body) return setTimeout(start, 50);
    build();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
