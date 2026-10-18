<section class="section demo-section">
  <div class="wrap">
    <p class="eyebrow reveal center">Product tour</p>
    <h2 class="section-title reveal">Watch a sale go through FlowSuit</h2>
    <p class="section-lead reveal">One sale at the counter updates stock, cash and reports in the same second. Sample data.</p>
    <div class="demo reveal" data-demo>
      <div class="demo-top">
        <span class="live-dot"><i></i> Live demo</span>
        <span class="demo-title">FlowSuit ERP · New sale</span>
        <button type="button" class="demo-toggle" data-demo-toggle aria-label="Pause the demo"><span class="i-pause"></span></button>
      </div>
      <div class="demo-screen" aria-hidden="true">
        <div class="demo-nav"><b class="is-on">Sales</b><b>Stock</b><b>Finance</b><b>Reports</b></div>
        <div class="demo-main">
          <div class="demo-kpis">
            <div><small>Today's sales</small><b data-k="sales" data-v="184500">184,500</b></div>
            <div><small>Cooking oil 5L in stock</small><b data-k="stock" data-v="82">82</b></div>
            <div><small>Cash in hand</small><b data-k="cash" data-v="96200">96,200</b></div>
          </div>
          <div class="demo-body">
            <div class="demo-form">
              <p><small>Customer</small><span data-type="Ali Traders"></span></p>
              <p><small>Item</small><span data-type="Cooking oil 5L x 6"></span></p>
              <p><small>Amount</small><span data-type="17,400"></span></p>
              <span class="demo-save" data-save>Save sale</span>
            </div>
            <div class="demo-bars"><i style="--h:42%"></i><i style="--h:58%"></i><i style="--h:50%"></i><i style="--h:66%"></i><i style="--h:61%"></i><i style="--h:74%"></i><i style="--h:48%" data-bar></i></div>
          </div>
        </div>
        <span class="demo-cursor" data-cursor></span>
        <span class="demo-toast" data-toast><?= icon('check') ?> Sale saved. Stock and books updated.</span>
      </div>
      <div class="demo-foot">
        <div class="demo-progress"><i data-progress></i></div>
        <p class="demo-caption" data-caption>1. The cashier enters a sale</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <p class="eyebrow reveal center">Industries</p>
    <h2 class="section-title reveal">Built for the way your industry works</h2>
    <p class="section-lead reveal">We start from the sheets and registers you already keep, so the software fits your trade from day one.</p>
    <div class="industry-grid">
<?php foreach ([
    ['cart', 'Retail and shops', ['Stock at every shelf and branch', 'A till that prints receipts', 'Daily sales and cash reports']],
    ['truck', 'Wholesale and distribution', ['Orders, deliveries and returns', 'Credit limits per customer', 'Receivables ageing by salesman']],
    ['build', 'Real estate and builders', ['Bookings and installment plans', 'Receivable and recovery tracking', 'Bank collection reports']],
    ['factory', 'Manufacturing', ['Raw material and finished goods', 'Production batches and costing', 'Purchase orders to suppliers']],
    ['pill', 'Pharmacies', ['Batch numbers and expiry dates', 'Reorder alerts before you run out', 'Supplier ledgers']],
    ['ledger', 'Accounting firms', ['Client ledgers in one place', 'Expense and invoice capture', 'Month-end reports in a click']],
] as $i => [$ic, $name, $items]): ?>
      <div class="industry reveal">
        <span class="industry-icon"><?= icon($ic) ?></span>
        <h3><?= e($name) ?></h3>
        <ul><?php foreach ($items as $it): ?><li><?= icon('check') ?><?= e($it) ?></li><?php endforeach; ?></ul>
      </div>
<?php endforeach; ?>
    </div>
  </div>
</section>
