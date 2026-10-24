<?php $mockTitle = $mockTitle ?? 'FlowSuit ERP'; ?>
<div class="dash" aria-hidden="true">
  <div class="mock-bar"><span></span><span></span><span></span> <?= e($mockTitle) ?><em class="mock-live">Live</em></div>
  <div class="dash-body">
    <div class="dash-nav">
      <i class="is-on"></i><i></i><i></i><i></i><i></i>
    </div>
    <div class="dash-main">
      <div class="dash-kpis">
        <div><small>Sales today</small><b data-count="184500">184,500</b></div>
        <div><small>Stock items</small><b data-count="1240">1,240</b></div>
        <div><small>Receivables</small><b data-count="62300">62,300</b></div>
      </div>
      <div class="dash-chart">
        <span style="--h:45%"></span><span style="--h:62%"></span><span style="--h:38%"></span><span style="--h:74%"></span>
        <span style="--h:58%"></span><span style="--h:86%"></span><span style="--h:70%"></span><span style="--h:94%"></span>
      </div>
    </div>
  </div>
</div>
