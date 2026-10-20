<?php $title = 'TAJ Receivables | FlowSuit ERP'; $active = 'receivables'; ?>
<header class="page-top">
  <div>
    <h1>TAJ Receivables</h1>
    <p class="muted"><?= $hasFile ? 'Receivable and recovery dashboards' . ($updated ? ' · file updated ' . e(date('j M Y', $updated)) : '') : 'The dashboard file has not been added yet.' ?></p>
  </div>
<?php if ($hasFile): ?>
  <div class="page-actions">
    <a class="btn btn-ghost" href="/erp/m/receivables/dashboard">Open dashboard</a>
<?php if ($me['is_admin']): ?>
    <button class="btn btn-ghost" type="button" data-toggle="#dash-upload">Replace file</button>
<?php endif; ?>
  </div>
<?php endif; ?>
</header>
<?php foreach ($errors as $err): ?>
<p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>
<?php if ($me['is_admin']): ?>
<form id="dash-upload" class="panel upload"<?= $hasFile && !$errors ? ' hidden' : '' ?> method="post" enctype="multipart/form-data">
  <?= erp_csrf_field() ?>
  <input type="hidden" name="action" value="dashboard">
  <h2><?= $hasFile ? 'Replace the dashboard file' : 'Add the TAJ dashboard file' ?></h2>
  <p class="muted">Upload <b>flowsuit-erp.zip</b> or the <b>index.html</b> inside it. It is stored privately on the server and only people with access to TAJ Receivables can open it.</p>
  <label class="drop"><?= icon('cloud') ?><span data-file-label>Choose the .zip or .html file</span><input type="file" name="dashboard" accept=".zip,.html,.htm" required></label>
  <button class="btn" type="submit">Upload dashboard</button>
</form>
<?php endif; ?>
<?php if ($uploads !== null): ?>
<form id="saved" class="panel" method="post" data-confirm="Delete the selected reports for everyone? Any report the dashboard is using now will disappear from it until a new file is uploaded.">
  <?= erp_csrf_field() ?>
  <input type="hidden" name="action" value="delete_uploads">
  <div class="table-head">
    <div><h2>Saved reports</h2><p class="muted">Every export uploaded to the dashboard. Tick the ones you no longer need and delete them. Deleted reports are gone for everyone, so download a backup first if unsure.</p></div>
    <button class="btn btn-danger" type="submit">Delete selected</button>
  </div>
<?php if ($uploads): ?>
  <div class="table-scroll">
    <table class="data">
      <thead><tr><th><input type="checkbox" data-check-all aria-label="Select all"></th><th>Report</th><th>File</th><th class="num">Rows</th><th>Uploaded by</th><th>When</th><th></th></tr></thead>
      <tbody>
<?php foreach ($uploads as $u): ?>
        <tr>
          <td><input type="checkbox" name="uploads[]" value="<?= e($u['id']) ?>" aria-label="Select <?= e($u['file']) ?>"></td>
          <td><?= e($u['kind']) ?></td>
          <td><?= e($u['file']) ?></td>
          <td class="num"><?= number_format($u['rows']) ?></td>
          <td><?= e($u['by']) ?></td>
          <td class="small"><?= $u['at'] ? e(date('j M Y, g:i a', intdiv($u['at'], 1000))) : '' ?></td>
          <td><?= $u['inUse'] ? '<span class="tag tag-ok">In use now</span>' : '' ?></td>
        </tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
<?php else: ?>
  <p class="muted">No reports have been uploaded to the dashboard yet.</p>
<?php endif; ?>
</form>
<?php endif; ?>
<?php if ($hasFile): ?>
<div class="frame-wrap"><iframe src="/erp/m/receivables/dashboard" title="TAJ receivables dashboard" loading="eager"></iframe></div>
<?php elseif (!$me['is_admin']): ?>
<div class="empty">
  <span class="mod-icon big"><?= icon('ledger') ?></span>
  <h2>Not added yet</h2>
  <p class="muted">An admin needs to upload the TAJ dashboard file first.</p>
</div>
<?php endif; ?>
