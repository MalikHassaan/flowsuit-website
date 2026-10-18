<?php $quote = 'mailto:' . config('contact_email') . '?subject=' . rawurlencode('Digitize my workbook'); ?>
<section class="hero">
  <div class="hero-bg" aria-hidden="true"><span class="blob blob-1"></span><span class="blob blob-2"></span><span class="grid-lines"></span></div>
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow anim-up">Workbook, finance and accounting digitization</p>
      <h1 class="anim-up d1">
        <span class="sr-only">Turn your workbooks into business software.</span>
        <span aria-hidden="true">Turn your<br><span class="rotator"><span>workbooks</span><span>stock sheets</span><span>ledgers</span><span>registers</span><span>workbooks</span></span><br>into <span class="text-gradient">business software.</span></span>
      </h1>
      <p class="lead anim-up d2">Your business runs on Excel files, Google Sheets and paper registers. FlowSuit turns them into one secure ERP for inventory, finance and sales that your whole team can use from any device.</p>
      <div class="actions anim-up d3">
        <a class="button button-shine" href="<?= e($quote) ?>">Digitize my workbook <?= icon('arrow') ?></a>
        <a class="button button-ghost" href="/products/erp">Explore FlowSuit ERP</a>
      </div>
      <p class="hero-note anim-up d4"><?= icon('check') ?> Free review of your current workbook</p>
    </div>
    <div class="transform anim-up d2" aria-hidden="true">
      <div class="sheet">
        <div class="sheet-title"><?= icon('sheet') ?> stock_register_FINAL_v3.xlsx</div>
        <div class="sheet-grid">
          <b></b><b>A</b><b>B</b><b>C</b>
          <b>1</b><i>Item</i><i>Qty</i><i>Price</i>
          <b>2</b><i>Cement</i><i>420</i><i>1,150</i>
          <b>3</b><i>Steel</i><i>38</i><i>2,400</i>
          <b>4</b><i>Paint</i><i>112</i><i>3,900</i>
          <b>5</b><i class="err">#REF!</i><i></i><i></i>
        </div>
        <span class="scan"></span>
      </div>
      <svg class="flow" viewBox="0 0 200 200" preserveAspectRatio="none">
        <path id="flow-a" d="M20 30 C 120 30, 80 170, 180 170" />
        <path id="flow-b" d="M20 60 C 140 60, 60 140, 180 140" />
        <circle r="4"><animateMotion dur="2.4s" repeatCount="indefinite"><mpath href="#flow-a"/></animateMotion></circle>
        <circle r="4"><animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite"><mpath href="#flow-b"/></animateMotion></circle>
        <circle r="3"><animateMotion dur="2.4s" begin="1.6s" repeatCount="indefinite"><mpath href="#flow-a"/></animateMotion></circle>
      </svg>
      <div class="mock-app float">
        <div class="mock-bar"><span></span><span></span><span></span> FlowSuit Inventory</div>
        <table>
          <tr><th>Item</th><th>In stock</th><th>Status</th></tr>
          <tr class="row-in r1"><td>Cement bags</td><td>420</td><td><span class="pill pill-ok">OK</span></td></tr>
          <tr class="row-in r2"><td>Steel rods</td><td>38</td><td><span class="pill pill-low pulse">Low</span></td></tr>
          <tr class="row-in r3"><td>Paint 20L</td><td>112</td><td><span class="pill pill-ok">OK</span></td></tr>
        </table>
      </div>
      <div class="toasts">
        <span class="toast t1"><?= icon('check') ?> Invoice INV-1043 paid</span>
        <span class="toast t2"><?= icon('boxes') ?> 50 steel rods received</span>
        <span class="toast t3"><?= icon('chart') ?> Sales up 12% this week</span>
      </div>
    </div>
  </div>
</section>

<section class="industries" aria-label="Industries we work with">
  <p>Built for businesses that run on spreadsheets</p>
  <div class="marquee">
    <div class="marquee-track">
<?php for ($copy = 0; $copy < 2; $copy++): ?>
      <span<?= $copy ? ' aria-hidden="true"' : '' ?>><?= icon('cart') ?> Retail</span>
      <span<?= $copy ? ' aria-hidden="true"' : '' ?>><?= icon('truck') ?> Wholesale &amp; distribution</span>
      <span<?= $copy ? ' aria-hidden="true"' : '' ?>><?= icon('factory') ?> Manufacturing</span>
      <span<?= $copy ? ' aria-hidden="true"' : '' ?>><?= icon('pill') ?> Pharmacies</span>
      <span<?= $copy ? ' aria-hidden="true"' : '' ?>><?= icon('build') ?> Construction</span>
      <span<?= $copy ? ' aria-hidden="true"' : '' ?>><?= icon('brief') ?> Services</span>
      <span<?= $copy ? ' aria-hidden="true"' : '' ?>><?= icon('ledger') ?> Accounting firms</span>
      <span<?= $copy ? ' aria-hidden="true"' : '' ?>><?= icon('store') ?> Restaurants</span>
<?php endfor; ?>
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

<section class="section section-dark connected">
  <div class="wrap split">
    <div class="orbit reveal" aria-hidden="true">
      <svg viewBox="0 0 400 400">
        <circle class="ring" cx="200" cy="200" r="140" />
        <path id="ln-1" class="link" d="M200 200 L200 60" />
        <path id="ln-2" class="link" d="M200 200 L321 270" />
        <path id="ln-3" class="link" d="M200 200 L79 270" />
        <circle class="packet" r="5"><animateMotion dur="2s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#ln-1"/></animateMotion></circle>
        <circle class="packet" r="5"><animateMotion dur="2s" begin=".66s" repeatCount="indefinite"><mpath href="#ln-2"/></animateMotion></circle>
        <circle class="packet" r="5"><animateMotion dur="2s" begin="1.33s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#ln-3"/></animateMotion></circle>
      </svg>
      <div class="node hub"><?= icon('erp') ?><b>FlowSuit ERP</b></div>
      <div class="node n1"><?= icon('boxes') ?><b>Inventory</b></div>
      <div class="node n2"><?= icon('ledger') ?><b>Finance</b></div>
      <div class="node n3"><?= icon('store') ?><b>Store</b></div>
    </div>
    <div>
      <p class="eyebrow reveal">One system</p>
      <h2 class="reveal">Enter it once. Everything else updates.</h2>
      <p class="lead reveal">A sale at the counter lowers stock, adds to today's revenue and posts to the books in the same second. No more typing the same number into three sheets.</p>
      <ul class="ticks">
        <li class="reveal"><?= icon('check') ?>Stock, sales and accounts always agree</li>
        <li class="reveal"><?= icon('check') ?>Every change recorded against a named user</li>
        <li class="reveal"><?= icon('check') ?>Start with one product, add the rest later</li>
      </ul>
    </div>
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

<section class="section section-charts">
  <div class="wrap">
    <p class="eyebrow reveal center">Reports</p>
    <h2 class="section-title reveal">See your numbers, not cells.</h2>
    <p class="section-lead reveal">Charts build themselves from the data you already enter. No formulas, no copy and paste.</p>
    <?php require __DIR__ . '/charts.php'; ?>
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
  <div class="wrap">
    <h2 class="section-title reveal">Guides</h2>
    <p class="section-lead reveal">Practical advice for businesses moving off spreadsheets.</p>
    <div class="grid-3">
<?php foreach (guides() as $g): ?>
      <a class="card guide-card reveal" href="/guides/<?= e($g['slug']) ?>">
        <span class="card-icon"><?= icon($g['icon']) ?></span>
        <h3><?= e($g['title']) ?></h3>
        <p><?= e($g['description']) ?></p>
        <span class="card-link">Read guide <?= icon('arrow') ?></span>
      </a>
<?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section section-soft">
  <div class="wrap narrow">
    <h2 class="section-title reveal">Questions</h2>
<?php foreach (home_faqs() as $q => $a): ?>
    <details class="reveal"><summary><?= e($q) ?></summary><p><?= e($a) ?></p></details>
<?php endforeach; ?>
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <h2 class="reveal">Send us the workbook. Get back an app.</h2>
    <a class="button button-light reveal" href="<?= e($quote) ?>">Get a free review <?= icon('arrow') ?></a>
  </div>
</section>
