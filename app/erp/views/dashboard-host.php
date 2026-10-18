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
<?php if ($hasFile): ?>
<div class="frame-wrap"><iframe src="/erp/m/receivables/dashboard" title="TAJ receivables dashboard" loading="eager"></iframe></div>
<?php elseif (!$me['is_admin']): ?>
<div class="empty">
  <span class="mod-icon big"><?= icon('ledger') ?></span>
  <h2>Not added yet</h2>
  <p class="muted">An admin needs to upload the TAJ dashboard file first.</p>
</div>
<?php endif; ?>
