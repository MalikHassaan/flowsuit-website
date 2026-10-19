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
<?php if ($check): $s = $check['sum']; $ok = !$check['unbalanced']; ?>
<form id="qb-check" class="panel upload qb-check" method="post" data-busy>
  <?= erp_csrf_field() ?>
  <h2>Check the QuickBooks report before importing</h2>
  <p class="muted"><b><?= e($check['file']) ?></b> for <b><?= e($companies[$check['entity']] ?? $check['entity']) ?></b></p>
  <div class="qb-sum">
    <span><b><?= number_format(count($check['txns'])) ?></b>transactions</span>
    <span><b><?= number_format($s['lines']) ?></b>lines</span>
    <span><b><?= e(date('j M Y', strtotime($s['from']))) ?></b>first date</span>
    <span><b><?= e(date('j M Y', strtotime($s['to']))) ?></b>last date</span>
    <span><b><?= number_format($s['debit'], 2) ?></b>total debit</span>
    <span class="<?= abs($s['debit'] - $s['credit']) < 0.01 ? 'is-ok' : 'is-bad' ?>"><b><?= number_format($s['credit'], 2) ?></b>total credit</span>
  </div>
<?php if (!$ok): ?>
  <p class="erp-error"><?= count($check['unbalanced']) ?> transaction(s) do not balance, so nothing can be imported. Fix them in QuickBooks and export again.</p>
  <div class="table-scroll"><table class="data"><thead><tr><th>Date</th><th>Type</th><th>Num</th><th class="num">Debit minus credit</th></tr></thead><tbody>
<?php foreach (array_slice($check['unbalanced'], 0, 50) as $u): ?>
    <tr><td><?= e($u['date']) ?></td><td><?= e($u['type']) ?></td><td><?= e($u['num']) ?></td><td class="num"><?= number_format($u['diff'], 2) ?></td></tr>
<?php endforeach; ?>
  </tbody></table></div>
<?php else: $left = count(array_filter($suggest, fn($v) => $v === '')); ?>
  <h3>Match each QuickBooks account to an HSEC account</h3>
  <p class="muted">Matches are remembered, so the next company or a re-import only asks about new accounts.<?= $left ? ' <b>' . $left . ' still to choose.</b>' : ' All accounts are matched; check them and import.' ?></p>
  <div class="table-scroll"><table class="data qb-map"><thead><tr><th>QuickBooks account</th><th class="num">Lines</th><th>HSEC account</th></tr></thead><tbody>
<?php $i = 0; foreach ($check['accounts'] as $qb => $n): $pick = $suggest[$qb] ?? ''; ?>
    <tr class="<?= $pick === '' ? 'is-todo' : '' ?>"><td><?= e($qb) ?></td><td class="num"><?= number_format($n) ?></td><td><select name="map[<?= $i++ ?>]" required>
      <option value="">Choose…</option>
<?php foreach ($posting as $id => $a): ?>
      <option value="<?= e($id) ?>"<?= $id === $pick ? ' selected' : '' ?>><?= e($a['code'] . ' ' . $a['name']) ?></option>
<?php endforeach; ?>
    </select></td></tr>
<?php endforeach; ?>
  </tbody></table></div>
<?php endif; ?>
  <div class="form-actions">
<?php if ($ok): ?>
    <button class="btn" type="submit" name="action" value="qb_import">Import <?= number_format(count($check['txns'])) ?> vouchers as posted</button>
<?php endif; ?>
    <button class="btn btn-ghost" type="submit" name="action" value="qb_cancel" formnovalidate>Cancel</button>
  </div>
</form>
<?php else: ?>
<form class="panel upload" method="post" enctype="multipart/form-data" data-busy>
  <?= erp_csrf_field() ?>
  <input type="hidden" name="action" value="qb_check">
  <h2>Import from QuickBooks</h2>
  <p class="muted">In QuickBooks open <b>Reports › Accountant &amp; Taxes › Journal</b>, set the dates from the first transaction to today, and export it to Excel. Do this once per company, then upload each file here with its company. You see a check before anything is saved.</p>
  <div class="form-grid">
    <label>Company<select name="entity" required>
<?php foreach ($companies as $code => $label): ?>
      <option value="<?= e($code) ?>"><?= e($label) ?></option>
<?php endforeach; ?>
    </select></label>
    <label>Dates in the file<select name="dates">
      <option value="auto">Work it out</option>
      <option value="dmy">Day first (31/12/2025)</option>
      <option value="mdy">Month first (12/31/2025)</option>
    </select></label>
  </div>
  <label class="drop"><?= icon('cloud') ?><span data-file-label>Choose the Journal report (.xlsx or .csv)</span><input type="file" name="journal" accept=".xlsx,.csv" required></label>
  <button class="btn" type="submit">Check the report</button>
</form>
<?php endif; ?>
<form class="panel upload" method="post" data-busy>
  <?= erp_csrf_field() ?>
  <input type="hidden" name="action" value="clear">
  <h2>Clear old HSEC records</h2>
  <p class="muted">Deletes every voucher, invoice, bill, payroll and other record in HSEC so you can start again from QuickBooks. It keeps the <b>chart of accounts</b>, the <b>company setup</b> and <b>users &amp; roles</b>. Every deleted record is still kept in the server's change log. Download a backup first under <a href="/erp/backups">Backups</a>.</p>
  <label>Type CLEAR to confirm<input name="confirm" autocomplete="off" required pattern="CLEAR" placeholder="CLEAR"></label>
  <button class="btn btn-danger" type="submit">Clear old records</button>
</form>
<form class="panel upload" method="post" enctype="multipart/form-data" data-busy>
  <?= erp_csrf_field() ?>
  <input type="hidden" name="action" value="import">
  <h2>Restore an HSEC backup</h2>
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
