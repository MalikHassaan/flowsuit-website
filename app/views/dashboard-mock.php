<?php
$mockTitle = $mockTitle ?? 'FlowSuit ERP';
// Gradient ids must be unique when the mock-up appears more than once on a page.
$GLOBALS['dashN'] = ($GLOBALS['dashN'] ?? 0) + 1;
$dn = 'd' . $GLOBALS['dashN'];
// Sample figures only. main.js redraws the line and the donut every couple of seconds.
$mix = [['Sales', 42, '#1F6FB8'], ['Services', 26, '#0B8BD0'], ['Store', 19, '#f59e0b'], ['Other', 13, '#13304f']];
$off = 0;
?>
<div class="dash" aria-hidden="true">
  <div class="mock-bar"><span></span><span></span><span></span> <?= e($mockTitle) ?><em class="mock-live">Live</em></div>
  <div class="dash-body">
    <div class="dash-nav">
      <i class="is-on"></i><i></i><i></i><i></i><i></i>
    </div>
    <div class="dash-main">
      <div class="dash-kpis">
        <div><small>Sales today</small><b data-count="184500">184,500</b><em class="dash-trend">▲ 8.2%</em></div>
        <div><small>Stock items</small><b data-count="1240">1,240</b><em class="dash-trend">▲ 2.1%</em></div>
        <div><small>Receivables</small><b data-count="62300">62,300</b><em class="dash-trend is-down">▼ 3.4%</em></div>
      </div>
      <div class="dash-charts">
        <div class="dash-card dash-line">
          <div class="dash-card-h"><b>Sales and forecast</b><span><i class="k-act"></i>Actual <i class="k-fc"></i>Forecast</span></div>
          <svg viewBox="0 0 300 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="<?= $dn ?>a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F6FB8" stop-opacity=".32"/><stop offset="1" stop-color="#1F6FB8" stop-opacity="0"/></linearGradient>
            </defs>
            <g class="dl-grid"><line x1="0" y1="30" x2="300" y2="30"/><line x1="0" y1="60" x2="300" y2="60"/><line x1="0" y1="90" x2="300" y2="90"/></g>
            <path class="dl-band" d=""/>
            <path class="dl-area" fill="url(#<?= $dn ?>a)" d=""/>
            <line class="dl-today" x1="0" y1="6" x2="0" y2="116"/>
            <path class="dl-fc" d="" vector-effect="non-scaling-stroke"/>
            <path class="dl-act" d="" pathLength="1" vector-effect="non-scaling-stroke"/>
          </svg>
          <span class="dl-dot"></span>
          <span class="dl-tag">Today</span>
        </div>
        <div class="dash-card dash-donut">
          <div class="dash-card-h"><b>Revenue mix</b></div>
          <div class="dd-ring">
            <svg viewBox="0 0 42 42">
              <circle class="dd-track" cx="21" cy="21" r="15.915"/>
<?php foreach ($mix as $i => [$label, $pct, $color]): ?>
              <circle class="dd-seg" cx="21" cy="21" r="15.915" stroke="<?= $color ?>" style="--p:<?= $pct ?>;--o:<?= $off ?>;--i:<?= $i ?>"/>
<?php $off += $pct; endforeach; ?>
            </svg>
            <div class="dd-mid"><b>78%</b><small>collected</small></div>
          </div>
          <ul class="dd-legend">
<?php foreach ($mix as [$label, $pct, $color]): ?>
            <li><i style="background:<?= $color ?>"></i><?= e($label) ?><b><?= $pct ?>%</b></li>
<?php endforeach; ?>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
