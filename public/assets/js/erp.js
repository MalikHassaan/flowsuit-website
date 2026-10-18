// FlowSuit ERP: small helpers. Every page still works without this file.
(function () {
  // Show / hide panels (the upload form).
  document.querySelectorAll('[data-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var el = document.querySelector(btn.getAttribute('data-toggle'));
      if (el) { el.hidden = !el.hidden; if (!el.hidden) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    });
  });

  // File picker: show the chosen name and highlight while dragging a file over it.
  document.querySelectorAll('.drop').forEach(function (drop) {
    var input = drop.querySelector('input[type=file]');
    var label = drop.querySelector('[data-file-label]');
    input.addEventListener('change', function () { if (input.files[0]) label.textContent = input.files[0].name; });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('is-over'); }); });
  });

  // Confirm before deleting.
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) { if (!confirm(form.getAttribute('data-confirm'))) e.preventDefault(); });
  });

  // Search box that filters table rows.
  document.querySelectorAll('[data-filter]').forEach(function (input) {
    var table = document.querySelector(input.getAttribute('data-filter'));
    if (!table) return;
    var rows = Array.prototype.slice.call(table.tBodies[0].rows);
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      rows.forEach(function (r) { r.hidden = q !== '' && r.textContent.toLowerCase().indexOf(q) === -1; });
    });
  });

  // Click a heading to sort by that column.
  function num(s) { var v = s.replace(/[^0-9.()-]/g, ''); if (/^\(.*\)$/.test(v)) v = '-' + v.slice(1, -1); return v === '' || isNaN(v) ? null : parseFloat(v); }
  document.querySelectorAll('table.data th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var table = th.closest('table'), body = table.tBodies[0], i = +th.getAttribute('data-sort');
      var dir = th.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
      table.querySelectorAll('th').forEach(function (h) { h.removeAttribute('data-dir'); });
      th.setAttribute('data-dir', dir);
      var rows = Array.prototype.slice.call(body.rows);
      rows.sort(function (a, b) {
        var x = a.cells[i].textContent, y = b.cells[i].textContent, nx = num(x), ny = num(y);
        var c = nx !== null && ny !== null ? nx - ny : x.localeCompare(y);
        return dir === 'asc' ? c : -c;
      });
      rows.forEach(function (r) { body.appendChild(r); });
    });
  });

  // Admins already have every module: grey out the access choices while "Admin" is ticked.
  var admin = document.querySelector('[data-admin]'), grid = document.querySelector('[data-access]');
  if (admin && grid) {
    var sync = function () { grid.classList.toggle('is-admin', admin.checked); };
    admin.addEventListener('change', sync); sync();
  }

  // Show / hide a password.
  document.querySelectorAll('[data-reveal]').forEach(function (btn) {
    var input = btn.parentNode.querySelector('input');
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('is-on', show);
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  // Password strength bar: length, mixed case, digits, symbols.
  document.querySelectorAll('[data-strength]').forEach(function (input) {
    var bar = input.closest('form').querySelector('.pw-meter i');
    if (!bar) return;
    input.addEventListener('input', function () {
      var v = input.value, n = 0;
      if (v.length >= 10) n++; if (v.length >= 14) n++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++; if (/\d/.test(v)) n++; if (/[^A-Za-z0-9]/.test(v)) n++;
      bar.style.width = (v ? Math.max(12, n * 20) : 0) + '%';
      bar.className = n < 2 ? 'weak' : n < 4 ? 'ok' : 'strong';
    });
  });

  // New user: show the password box only when the admin sets the password.
  var modes = document.querySelectorAll('[data-pw-mode]'), pwSet = document.querySelector('[data-pw-set]');
  if (modes.length && pwSet) {
    var pick = function () {
      var set = document.querySelector('[data-pw-mode]:checked').value === 'set';
      pwSet.hidden = !set; pwSet.querySelector('input[type=password]').required = set;
    };
    modes.forEach(function (m) { m.addEventListener('change', pick); }); pick();
  }

  // Copy a link to the clipboard.
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = btn.parentNode.querySelector('[data-copy-src]');
      src.select();
      (navigator.clipboard ? navigator.clipboard.writeText(src.value) : Promise.reject()).catch(function () { document.execCommand('copy'); });
      btn.textContent = 'Copied';
    });
  });

  // Sign-in forms: show that the button is working.
  document.querySelectorAll('form[data-busy]').forEach(function (form) {
    form.addEventListener('submit', function () { var b = form.querySelector('button[type=submit]'); if (b) b.classList.add('is-busy'); });
  });
})();
