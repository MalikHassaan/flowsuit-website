<?php
$stock = [['Cooking oil 5L', 82, 120], ['Rice 10kg', 64, 100], ['Sugar 1kg', 24, 90], ['Tea 950g', 47, 80], ['Flour 20kg', 15, 60], ['Soap bar', 112, 150]];
$mods = ['Inventory', 'Finance', 'Store', 'ERP'];
$features = [
    ['Live stock levels', [1, 0, 1, 1]], ['Low-stock alerts', [1, 0, 1, 1]], ['Invoices and receipts', [0, 1, 1, 1]],
    ['Ledger and expenses', [0, 1, 0, 1]], ['Point-of-sale till', [0, 0, 1, 1]], ['Logins and access per person', [1, 1, 1, 1]],
    ['Reports and charts', [1, 1, 1, 1]], ['Multiple branches and warehouses', [0, 0, 0, 1]],
];
?>
<section class="section section-soft">
  <div class="wrap">
    <p class="eyebrow reveal center">Live data</p>
    <h2 class="section-title reveal">Tables that update themselves</h2>
    <p class="section-lead reveal">No more refreshing a shared file. Every sale, delivery and payment shows up for the whole team straight away.</p>
    <div class="tables-grid">
      <div class="data-card reveal" data-live>
        <div class="data-card-head"><b>Stock on hand</b><span class="live-dot"><i></i> Updating</span></div>
        <table class="data-table">
          <thead><tr><th>Item</th><th>Qty</th><th class="col-level">Level</th><th>Status</th></tr></thead>
          <tbody>
<?php foreach ($stock as [$name, $qty, $max]): ?>
            <tr data-max="<?= $max ?>"><td><?= e($name) ?></td><td class="num" data-qty><?= $qty ?></td><td class="col-level"><span class="level"><i style="width:<?= round($qty / $max * 100) ?>%"></i></span></td><td><span class="pill <?= $qty < 25 ? 'pill-low' : 'pill-ok' ?>" data-status><?= $qty < 25 ? 'Reorder' : 'OK' ?></span></td></tr>
<?php endforeach; ?>
          </tbody>
        </table>
        <p class="data-note" data-live-note>Sample data. Watch the numbers change as sales come in.</p>
      </div>
      <div class="data-card reveal">
        <div class="data-card-head"><b>Which module does what</b></div>
        <div class="table-wrap">
          <table class="data-table matrix">
            <thead><tr><th>Feature</th><?php foreach ($mods as $m): ?><th><?= e($m) ?></th><?php endforeach; ?></tr></thead>
            <tbody>
<?php foreach ($features as $r => [$label, $has]): ?>
              <tr><td><?= e($label) ?></td><?php foreach ($has as $c => $yes): ?><td><?= $yes ? '<span class="tick" style="--d:' . ($r * 4 + $c) . '">' . icon('check') . '</span>' : '<span class="no-mark" role="img" aria-label="No"></span>' ?></td><?php endforeach; ?></tr>
<?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="data-card rollout reveal">
      <div class="data-card-head"><b>Example rollout plan for one module</b><span class="data-sub">Larger setups take longer. We agree the plan with you first.</span></div>
      <div class="table-wrap">
        <table class="data-table gantt">
          <thead><tr><th>Step</th><th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th></tr></thead>
          <tbody>
<?php foreach ([['Review your workbook', 1, 1], ['Map your process and agree the screens', 1, 2], ['Build and move your data in', 2, 2], ['Train your team and go live', 4, 1]] as $i => [$step, $from, $len]): ?>
            <tr><td><?= e($step) ?></td><td colspan="4" class="gantt-row"><span class="gantt-bar" style="--from:<?= $from - 1 ?>;--len:<?= $len ?>;--i:<?= $i ?>"></span></td></tr>
<?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>
