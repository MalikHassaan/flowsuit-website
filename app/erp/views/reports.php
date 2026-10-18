<?php $title = 'Reports | FlowSuit ERP'; $active = 'reports'; $s = $current['summary'] ?? null; ?>
<header class="page-top">
  <div>
    <h1>Reports</h1>
    <p class="muted"><?= $current ? e($current['title']) . ' · uploaded ' . e(date('j M Y, g:i a', strtotime($current['uploaded_at']))) : 'No report uploaded yet.' ?></p>
  </div>
<?php if ($canEdit): ?>
  <button class="btn" type="button" data-toggle="#upload"><?= icon('cloud') ?>Upload report</button>
<?php endif; ?>
</header>

<?php foreach ($errors as $err): ?>
<p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>

<?php if ($canEdit): ?>
<form id="upload" class="panel upload"<?= $current && !$errors ? ' hidden' : '' ?> method="post" enctype="multipart/form-data">
  <?= erp_csrf_field() ?>
  <input type="hidden" name="action" value="upload">
  <h2>Upload a report</h2>
  <p class="muted">Excel (.xlsx) or .csv, up to 8 MB. The first row with headings is used as columns; "Total" rows are left out of the sums.</p>
  <label class="drop"><?= icon('sheet') ?><span data-file-label>Choose a file or drop it here</span><input type="file" name="report" accept=".xlsx,.csv" required></label>
  <label>Name (optional)<input name="title" maxlength="120" placeholder="e.g. Receivables, October"></label>
  <button class="btn" type="submit">Upload</button>
</form>
<?php endif; ?>

<?php if ($current): ?>
<section class="kpis">
  <div class="kpi"><small>Total outstanding</small><b><?= erp_money($s['total']) ?></b><span><?= $s['amount'] !== null ? 'from "' . e($current['columns'][$s['amount']]) . '"' : 'no amount column found' ?></span></div>
  <div class="kpi"><small>Customers</small><b><?= $s['customers'] ?: '-' ?></b><span><?= $s['rows'] ?> rows</span></div>
  <div class="kpi<?= $s['oldestSum'] ? ' kpi-warn' : '' ?>"><small>Oldest bucket<?= $s['oldest'] ? ' (' . e($s['oldest']) . ')' : '' ?></small><b><?= erp_money($s['oldestSum']) ?></b><span><?= $s['oldestSum'] && $s['total'] ? round($s['oldestSum'] / $s['total'] * 100) . '% of total' : 'no aging found' ?></span></div>
</section>

<div class="chart-row">
<?php if ($s['buckets']): $max = max(array_map('abs', $s['buckets'])) ?: 1; ?>
  <figure class="panel chart">
    <figcaption><b>Aging</b><span class="muted"><?= e($s['basis']) ?></span></figcaption>
    <div class="vbars">
<?php $n = count($s['buckets']); $k = 0; foreach ($s['buckets'] as $label => $sum): ?>
      <div class="vbar" style="--h:<?= round(abs($sum) / $max * 100) ?>%;--i:<?= $k ?>"><b><?= erp_money($sum) ?></b><i class="<?= $k === $n - 1 ? 'is-old' : ($k >= $n - 2 ? 'is-late' : '') ?>"></i><small><?= e($label) ?></small></div>
<?php $k++; endforeach; ?>
    </div>
  </figure>
<?php endif; ?>
<?php if ($s['top']): $max = max(array_map('abs', $s['top'])) ?: 1; ?>
  <figure class="panel chart">
    <figcaption><b>Biggest balances</b><span class="muted">top <?= count($s['top']) ?> customers</span></figcaption>
    <ul class="hbars">
<?php $k = 0; foreach ($s['top'] as $name => $sum): ?>
      <li style="--w:<?= round(abs($sum) / $max * 100) ?>%;--i:<?= $k++ ?>"><span><?= e($name) ?></span><i></i><b><?= erp_money($sum) ?></b></li>
<?php endforeach; ?>
    </ul>
  </figure>
<?php endif; ?>
</div>

<section class="panel">
  <div class="table-head">
    <h2>All rows</h2>
    <input type="search" placeholder="Search customer, invoice..." data-filter="#rows" aria-label="Search rows">
  </div>
  <div class="table-scroll">
    <table id="rows" class="data">
      <thead><tr><?php foreach ($current['columns'] as $i => $h): ?><th class="<?= $s['numeric'][$i] ? 'num' : '' ?>" data-sort="<?= $i ?>"><?= e($h) ?></th><?php endforeach; ?></tr></thead>
      <tbody>
<?php foreach ($current['rows'] as $r): ?>
        <tr<?= erp_is_total_row($r) ? ' class="is-total"' : '' ?>><?php foreach ($current['columns'] as $i => $_): $v = $r[$i] ?? ''; ?><td class="<?= $s['numeric'][$i] ? 'num' : '' ?>"><?= e($v) ?></td><?php endforeach; ?></tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<?php else: ?>
<div class="empty">
  <span class="mod-icon big"><?= icon('ledger') ?></span>
  <h2>No report uploaded yet</h2>
  <p class="muted"><?= $canEdit ? 'Upload an Excel or CSV export, such as receivables, to see totals, aging and the biggest balances.' : 'Someone with upload access needs to add the first report.' ?></p>
</div>
<?php endif; ?>

<?php if (count($reports) > 1 || ($reports && $canEdit)): ?>
<section class="panel">
  <h2>Uploads</h2>
  <ul class="uploads">
<?php foreach ($reports as $r): ?>
    <li class="<?= $current && $r['id'] == $current['id'] ? 'is-on' : '' ?>">
      <a href="/erp/m/reports?report=<?= (int) $r['id'] ?>"><b><?= e($r['title']) ?></b><span class="muted"><?= e($r['filename']) ?> · <?= (int) $r['row_count'] ?> rows · <?= e(date('j M Y', strtotime($r['uploaded_at']))) ?><?= $r['uploader'] ? ' · ' . e($r['uploader']) : '' ?></span></a>
<?php if ($canEdit): ?>
      <form method="post" data-confirm="Delete this upload?"><?= erp_csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="report" value="<?= (int) $r['id'] ?>"><button class="link-danger" type="submit">Delete</button></form>
<?php endif; ?>
    </li>
<?php endforeach; ?>
  </ul>
</section>
<?php endif; ?>
