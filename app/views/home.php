<?php $quote = 'mailto:' . config('contact_email') . '?subject=' . rawurlencode('Digitize my workbook'); ?>
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">Workbook, finance and accounting digitization</p>
      <h1>Turn your workbooks into business software.</h1>
      <p class="lead">Your business runs on Excel files, Google Sheets and paper registers. FlowSuit turns them into secure apps for inventory, finance and sales that your whole team can use from any device.</p>
      <div class="actions">
        <a class="button" href="<?= e($quote) ?>">Digitize my workbook</a>
        <a class="button button-ghost" href="/products">See the products</a>
      </div>
      <p class="hero-note"><?= icon('check') ?> Free review of your current workbook</p>
    </div>
    <div class="mock" aria-hidden="true">
      <div class="mock-file"><?= icon('sheet') ?> stock_register_FINAL_v3.xlsx</div>
      <div class="mock-arrow"><?= icon('arrow') ?></div>
      <div class="mock-app">
        <div class="mock-bar"><span></span><span></span><span></span> FlowSuit Inventory</div>
        <table>
          <tr><th>Item</th><th>In stock</th><th>Status</th></tr>
          <tr><td>Cement bags</td><td>420</td><td><span class="pill pill-ok">OK</span></td></tr>
          <tr><td>Steel rods</td><td>38</td><td><span class="pill pill-low">Low</span></td></tr>
          <tr><td>Paint 20L</td><td>112</td><td><span class="pill pill-ok">OK</span></td></tr>
        </table>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2 class="section-title">Sound familiar?</h2>
    <div class="grid-3">
      <div class="panel"><h3>Five copies of the same file</h3><p>Everyone has their own version, and nobody knows which one is right.</p></div>
      <div class="panel"><h3>One person holds the formulas</h3><p>When they are away, the reports stop and nobody dares to touch the sheet.</p></div>
      <div class="panel"><h3>Hours of copy and paste</h3><p>Sales, stock and expenses get typed in twice, and mistakes slip through.</p></div>
    </div>
  </div>
</section>

<section class="section section-soft">
  <div class="wrap">
    <h2 class="section-title">How it works</h2>
    <ol class="steps">
      <li><strong>Send us your workbook</strong><span>Excel, Google Sheets or photos of your register.</span></li>
      <li><strong>We map your process</strong><span>We learn how your team uses it today.</span></li>
      <li><strong>We build your app</strong><span>Using FlowSuit products or a custom build.</span></li>
      <li><strong>Your team logs in</strong><span>Your data is moved over, and everyone works in one place.</span></li>
    </ol>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2 class="section-title">Products</h2>
    <p class="section-lead">Ready-made building blocks for the workbooks most businesses keep.</p>
    <div class="grid-3">
<?php foreach (products_of_type('product') as $p) { require __DIR__ . '/card.php'; } ?>
    </div>
  </div>
</section>

<section class="section section-soft">
  <div class="wrap">
    <h2 class="section-title">Workbook vs FlowSuit</h2>
    <div class="table-wrap">
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

<section class="section">
  <div class="wrap">
    <h2 class="section-title">Services</h2>
    <p class="section-lead">Need something specific? Our team builds it for you.</p>
    <div class="grid-4">
<?php foreach (products_of_type('service') as $p) { require __DIR__ . '/card.php'; } ?>
    </div>
  </div>
</section>

<section class="section section-soft">
  <div class="wrap narrow">
    <h2 class="section-title">Questions</h2>
    <details><summary>Do I lose my existing data?</summary><p>No. We move the data from your current workbook into the new system as part of the project.</p></details>
    <details><summary>Can I keep using Google Sheets?</summary><p>Yes. If your team prefers Sheets, we can automate it with Google Apps Script instead of replacing it.</p></details>
    <details><summary>Does it work on mobile?</summary><p>Yes. FlowSuit apps work in a phone browser, and we also build Android and iPhone apps.</p></details>
    <details><summary>How much does it cost?</summary><p>It depends on the size of your workbook and process. Send it to us for a free review and a fixed quote.</p></details>
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <h2>Send us the workbook. Get back an app.</h2>
    <a class="button button-light" href="<?= e($quote) ?>">Get a free review</a>
  </div>
</section>
