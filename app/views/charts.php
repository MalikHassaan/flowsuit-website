<?php
// Sample dashboards shown on the home page. Figures are illustrative, not customer results.
$cash = [42, 45, 44, 51, 49, 56, 60, 58, 66, 71, 69, 78];
$cashPoints = [];
foreach ($cash as $i => $v) {
    $cashPoints[] = round(10 + $i * (300 / (count($cash) - 1)), 1) . ',' . round(130 - ($v - 30) * 2, 1);
}
$cashLine = 'M' . implode(' L', $cashPoints);
$cashArea = $cashLine . ' L310,130 L10,130 Z';
$last = explode(',', end($cashPoints));

$months = ['May' => [62, 48], 'Jun' => [70, 52], 'Jul' => [66, 55], 'Aug' => [81, 57], 'Sep' => [88, 60], 'Oct' => [96, 63]];

$spend = [['Stock purchases', 46, 'var(--brand)'], ['Salaries', 28, 'var(--brand-2)'], ['Rent and utilities', 16, 'var(--accent)'], ['Other', 10, '#94a3b8']];

$stock = [['Cooking oil 5L', 82, false], ['Rice 10kg', 64, false], ['Sugar 1kg', 18, true], ['Tea 950g', 47, false], ['Flour 20kg', 12, true]];
?>
<div class="chart-grid">
  <figure class="chart-card reveal">
    <figcaption><span>Cash in the bank</span><b data-count="78400">78,400</b><em class="up">+86% in 12 weeks</em></figcaption>
    <svg class="chart-line" viewBox="0 0 320 140" role="img" aria-label="Line chart: cash balance rising over 12 weeks">
      <defs>
        <linearGradient id="cash-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#714B67" stop-opacity=".35"/>
          <stop offset="1" stop-color="#714B67" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g class="gridline"><line x1="10" y1="30" x2="310" y2="30"/><line x1="10" y1="63" x2="310" y2="63"/><line x1="10" y1="96" x2="310" y2="96"/><line x1="10" y1="130" x2="310" y2="130"/></g>
      <path class="area" d="<?= $cashArea ?>" fill="url(#cash-fill)"/>
      <path class="line" d="<?= $cashLine ?>" pathLength="1"/>
      <circle class="dot" cx="<?= $last[0] ?>" cy="<?= $last[1] ?>" r="5"/>
    </svg>
  </figure>

  <figure class="chart-card reveal">
    <figcaption><span>Revenue vs expenses</span><b>Last 6 months</b>
      <em class="legend"><i style="background:var(--brand)"></i>Revenue <i style="background:var(--accent)"></i>Expenses</em></figcaption>
    <div class="chart-bars" role="img" aria-label="Bar chart: revenue growing faster than expenses from May to October">
      <?php foreach ($months as $m => [$rev, $exp]): ?>
        <div class="bar-group">
          <span class="bar" style="--h:<?= $rev ?>%"></span><span class="bar bar-alt" style="--h:<?= $exp ?>%"></span>
          <small><?= e($m) ?></small>
        </div>
      <?php endforeach; ?>
    </div>
  </figure>

  <figure class="chart-card reveal">
    <figcaption><span>Where the money goes</span><b>October</b></figcaption>
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Donut chart of monthly spending by category">
        <circle class="donut-track" cx="21" cy="21" r="15.915"/>
        <?php $offset = 25; foreach ($spend as $i => [$label, $pct, $color]): ?>
          <circle class="donut-seg" cx="21" cy="21" r="15.915" stroke="<?= $color ?>" stroke-dasharray="<?= $pct - 1 ?> <?= 101 - $pct ?>" stroke-dashoffset="<?= $offset ?>" style="--i:<?= $i ?>"/>
        <?php $offset -= $pct; endforeach; ?>
        <text x="21" y="20" class="donut-num">100%</text><text x="21" y="26" class="donut-sub">tracked</text>
      </svg>
      <ul class="donut-legend">
        <?php foreach ($spend as [$label, $pct, $color]): ?>
          <li><i style="background:<?= $color ?>"></i><?= e($label) ?><b><?= $pct ?>%</b></li>
        <?php endforeach; ?>
      </ul>
    </div>
  </figure>

  <figure class="chart-card reveal">
    <figcaption><span>Stock levels</span><b>2 items to reorder</b></figcaption>
    <ul class="hbars" aria-label="Stock level per item, low items highlighted">
      <?php foreach ($stock as [$item, $level, $low]): ?>
        <li class="<?= $low ? 'is-low' : '' ?>"><span><?= e($item) ?><?php if ($low): ?> <em class="pill pill-low">Reorder</em><?php endif; ?></span>
          <i style="--w:<?= $level ?>%"></i><b><?= $level ?>%</b></li>
      <?php endforeach; ?>
    </ul>
  </figure>
</div>
<p class="chart-note">Sample data. Your dashboards show your own numbers.</p>
