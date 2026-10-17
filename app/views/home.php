<?php $quote = 'mailto:' . config('contact_email') . '?subject=' . rawurlencode('Digitize my workbook'); ?>
<section class="hero">
  <div class="hero-bg" aria-hidden="true"><span class="blob blob-1"></span><span class="blob blob-2"></span><span class="grid-lines"></span></div>
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow anim-up">Workbook, finance and accounting digitization</p>
      <h1 class="anim-up d1">Turn your workbooks into <span class="text-gradient">business software.</span></h1>
      <p class="lead anim-up d2">Your business runs on Excel files, Google Sheets and paper registers. FlowSuit turns them into one secure ERP for inventory, finance and sales that your whole team can use from any device.</p>
      <div class="actions anim-up d3">
        <a class="button" href="<?= e($quote) ?>">Digitize my workbook <?= icon('arrow') ?></a>
        <a class="button button-ghost" href="/products/erp">Explore FlowSuit ERP</a>
      </div>
      <p class="hero-note anim-up d4"><?= icon('check') ?> Free review of your current workbook</p>
    </div>
    <div class="mock anim-up d2" aria-hidden="true">
      <div class="mock-file"><?= icon('sheet') ?> stock_register_FINAL_v3.xlsx</div>
      <div class="mock-arrow"><?= icon('arrow') ?></div>
      <div class="mock-app float">
        <div class="mock-bar"><span></span><span></span><span></span> FlowSuit Inventory</div>
        <table>
          <tr><th>Item</th><th>In stock</th><th>Status</th></tr>
          <tr class="row-in r1"><td>Cement bags</td><td>420</td><td><span class="pill pill-ok">OK</span></td></tr>
          <tr class="row-in r2"><td>Steel rods</td><td>38</td><td><span class="pill pill-low pulse">Low</span></td></tr>
          <tr class="row-in r3"><td>Paint 20L</td><td>112</td><td><span class="pill pill-ok">OK</span></td></tr>
        </table>
      </div>
    </div>
  </div>
</section>

<section class="industries">
  <div class="wrap">
    <p>Built for businesses that run on spreadsheets</p>
    <div class="industry-row">
      <span class="reveal"><?= icon('cart') ?> Retail</span>
      <span class="reveal"><?= icon('truck') ?> Wholesale &amp; distribution</span>
      <span class="reveal"><?= icon('factory') ?> Manufacturing</span>
      <span class="reveal"><?= icon('pill') ?> Pharmacies</span>
      <span class="reveal"><?= icon('build') ?> Construction</span>
      <span class="reveal"><?= icon('brief') ?> Services</span>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2 class="section-title reveal">Sound familiar?</h2>
    <div class="grid-3">
      <div class="panel reveal"><span class="card-icon"><?= icon('sheet') ?></span><h3>Five copies of the same file</h3><p>Everyone has their own version, and nobody knows which one is right.</p></div>
      <div class="panel reveal"><span class="card-icon"><?= icon('shield') ?></span><h3>One person holds the formulas</h3><p>When they are away, the reports stop and nobody dares to touch the sheet.</p></div>
      <div class="panel reveal"><span class="card-icon"><?= icon('bolt') ?></span><h3>Hours of copy and paste</h3><p>Sales, stock and expenses get typed in twice, and mistakes slip through.</p></div>
    </div>
  </div>
</section>

<section class="section section-soft">
  <div class="wrap">
    <h2 class="section-title reveal">How it works</h2>
    <ol class="steps">
      <li class="reveal"><strong>Send us your workbook</strong><span>Excel, Google Sheets or photos of your register.</span></li>
      <li class="reveal"><strong>We map your process</strong><span>We learn how your team uses it today.</span></li>
      <li class="reveal"><strong>We set up FlowSuit</strong><span>Using FlowSuit ERP or a custom build.</span></li>
      <li class="reveal"><strong>Your team logs in</strong><span>Your data is moved over, and everyone works in one place.</span></li>
    </ol>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div>
      <p class="eyebrow reveal">FlowSuit ERP</p>
      <h2 class="reveal">Your whole business on one screen.</h2>
      <p class="lead reveal">Every sale updates stock and the books at the same moment. Owners see sales, inventory and cash live, without waiting for someone to update a spreadsheet.</p>
      <ul class="ticks">
        <li class="reveal"><?= icon('check') ?>Live dashboard for sales, stock and cash</li>
        <li class="reveal"><?= icon('check') ?>Roles and permissions for every staff member</li>
        <li class="reveal"><?= icon('check') ?>Works on desktop, tablet and phone</li>
      </ul>
      <a class="button reveal" href="/products/erp">See FlowSuit ERP <?= icon('arrow') ?></a>
    </div>
    <div class="reveal"><?php $mockTitle = 'FlowSuit ERP'; require __DIR__ . '/dashboard-mock.php'; ?></div>
  </div>
</section>

<section class="section section-soft">
  <div class="wrap">
    <h2 class="section-title reveal">Products</h2>
    <p class="section-lead reveal">Start with one, or run the whole business on FlowSuit ERP.</p>
    <div class="grid-4">
<?php foreach (products_of_type('product') as $p) { require __DIR__ . '/card.php'; } ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2 class="section-title reveal">Workbook vs FlowSuit</h2>
    <div class="table-wrap reveal">
      <table class="compare">
        <tr><th></th><th>Workbook</th><th>FlowSuit</th></tr>
        <tr><td>Everyone works on the same live data</td><td><?= icon('cross') ?></td><td><?= icon('check') ?></td></tr>
        <tr><td>Logins and permissions per person</td><td><?= icon('cross') ?></td><td><?= icon('check') ?></td></tr>
        <tr><td>History of who changed what</td><td><?= icon('cross') ?></td><td><?= icon('check') ?></td></tr>
        <tr><td>Works properly on a phone</td><td><?= icon('cross') ?></td><td><?= icon('check') ?></td></tr>
        <tr><td>Reports update by themselves</td><td><?= icon('cross') ?></td><td><?= icon('check') ?></td></tr>
      </table>
    </div>
  </div>
</section>

<section class="section section-soft">
  <div class="wrap">
    <h2 class="section-title reveal">Services</h2>
    <p class="section-lead reveal">Need something specific? Our team builds it for you.</p>
    <div class="grid-4">
<?php foreach (products_of_type('service') as $p) { require __DIR__ . '/card.php'; } ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap narrow">
    <h2 class="section-title reveal">Questions</h2>
    <details class="reveal"><summary>Do I lose my existing data?</summary><p>No. We move the data from your current workbook into FlowSuit as part of the project.</p></details>
    <details class="reveal"><summary>Can I keep using Google Sheets?</summary><p>Yes. If your team prefers Sheets, we can automate it with Google Apps Script instead of replacing it.</p></details>
    <details class="reveal"><summary>Does it work on mobile?</summary><p>Yes. FlowSuit works in a phone browser, and we also build Android and iPhone apps.</p></details>
    <details class="reveal"><summary>How much does it cost?</summary><p>It depends on the size of your workbook and process. Send it to us for a free review and a fixed quote.</p></details>
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <h2 class="reveal">Send us the workbook. Get back an app.</h2>
    <a class="button button-light reveal" href="<?= e($quote) ?>">Get a free review <?= icon('arrow') ?></a>
  </div>
</section>
