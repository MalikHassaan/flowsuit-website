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
})();
