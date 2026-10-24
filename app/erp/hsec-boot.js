// HSEC loading screen: adds the rings, orbiting dots, corners and subtitle around the app's own emblem,
// name, progress bar and loading text (which the app keeps updating and removes when the books are ready).
addEventListener("DOMContentLoaded", function () {
  var boot = document.getElementById("boot"), bt = boot && boot.querySelector(".bt"), logo = bt && bt.querySelector(".bt-logo");
  if (!logo) return;
  boot.insertAdjacentHTML("afterbegin", '<span class="fsb-corner c1"></span><span class="fsb-corner c2"></span><span class="fsb-corner c3"></span><span class="fsb-corner c4"></span><span class="fsb-tag">FLOWSUIT ERP</span>');
  var core = document.createElement("div");
  core.className = "fsb-core";
  core.innerHTML = '<i class="r1"><b></b><b></b></i><i class="r2"><b></b></i><i class="r3"><b></b></i>';
  logo.parentNode.insertBefore(core, logo);
  core.appendChild(logo);
  var name = bt.querySelector(".bt-name");
  if (name) {
    name.textContent = "HSEC";
    name.insertAdjacentHTML("afterend", '<div class="fsb-sub">Finance &amp; Accounting ERP</div>');
  }
});
