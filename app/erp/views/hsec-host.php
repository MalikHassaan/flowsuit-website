<?php $title = 'HSEC Finance | FlowSuit ERP'; $active = 'hsec'; ?>
<header class="page-top">
  <div>
    <h1>HSEC Finance</h1>
    <p class="muted"><?= $hasFile ? 'Finance ERP' . ($updated ? ' · file updated ' . e(date('j M Y', $updated)) : '') . ' · ' . number_format($counts['records']) . ' records, ' . number_format($counts['journals']) . ' vouchers' : 'The HSEC file has not been added yet.' ?></p>
  </div>
<?php if ($hasFile): ?>
  <div class="page-actions"><a class="btn" href="/erp/m/hsec/app">Open HSEC Finance</a></div>
<?php endif; ?>
</header>
<?php foreach ($errors as $err): ?>
<p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>
<?php if ($me['is_admin']): ?>
<form class="panel upload" method="post" enctype="multipart/form-data" data-busy>
  <?= erp_csrf_field() ?>
  <input type="hidden" name="action" value="app">
  <h2><?= $hasFile ? '1. Replace the HSEC file' : '1. Add the HSEC file' ?></h2>
  <p class="muted">Upload the HSEC Finance ERP <b>index.html</b> (or the .zip it came in). It is kept privately on the server; only people with HSEC access can open it. You do not need to fill in the Supabase values in it.</p>
  <label class="drop"><?= icon('cloud') ?><span data-file-label>Choose the .html or .zip file</span><input type="file" name="app" accept=".zip,.html,.htm" required></label>
  <button class="btn" type="submit">Upload file</button>
</form>
<form class="panel upload" method="post" enctype="multipart/form-data" data-busy>
  <?= erp_csrf_field() ?>
  <input type="hidden" name="action" value="import">
  <h2>2. Import a backup</h2>
  <p class="muted">In the old HSEC copy open <b>Setup &amp; maintenance › Security &amp; audit › Backup &amp; restore</b> and download a backup, then upload that .json here. Records come back with their original ids, so importing the same file twice changes nothing. Posted vouchers already here are never changed.</p>
  <label class="drop"><?= icon('cloud') ?><span data-file-label>Choose the backup .json</span><input type="file" name="backup" accept=".json,.zip,application/json" required></label>
  <button class="btn" type="submit">Import backup</button>
</form>
<?php elseif (!$hasFile): ?>
<div class="empty">
  <span class="mod-icon big"><?= icon('chart') ?></span>
  <h2>Not added yet</h2>
  <p class="muted">An admin needs to add the HSEC file first.</p>
</div>
<?php endif; ?>
