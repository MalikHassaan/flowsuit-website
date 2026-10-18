<?php $quote = 'mailto:' . config('contact_email') . '?subject=' . rawurlencode('Digitize my workbook'); ?>
<section class="hero hero-pro">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow anim-up">ERP and business software</p>
      <h1 class="anim-up d1">Run your business on <span>one secure platform.</span></h1>
      <p class="lead anim-up d2">FlowSuit turns the Excel workbooks, Google Sheets and paper registers you rely on into one system for inventory, finance, sales and accounting, with a login for every member of your team.</p>
      <div class="actions anim-up d3">
        <a class="button" href="<?= e($quote) ?>">Get a free workbook review <?= icon('arrow') ?></a>
        <a class="button button-outline" href="/products/erp">Explore FlowSuit ERP</a>
      </div>
      <ul class="hero-ticks anim-up d4">
        <li><?= icon('check') ?>Built around how you work today</li>
        <li><?= icon('check') ?>Per-user access and audit trail</li>
        <li><?= icon('check') ?>Daily backups you keep</li>
      </ul>
    </div>
    <div class="hero-shot anim-up d2"><?php $mockTitle = 'FlowSuit ERP'; require __DIR__ . '/dashboard-mock.php'; ?></div>
  </div>
</section>

<section class="section modules">
  <div class="wrap">
    <p class="eyebrow reveal center">Modules and services</p>
    <h2 class="section-title reveal">Everything your business needs, in one place</h2>
    <p class="section-lead reveal">Start with the module you need most and add the rest when you are ready. Every module shares the same data.</p>
    <div class="module-grid">
<?php foreach (array_merge(products_of_type('product'), products_of_type('service')) as $p): ?>
      <a class="module reveal" href="<?= e(product_path($p)) ?>">
        <span class="module-icon"><?= icon($p['icon']) ?></span>
        <span><b><?= e($p['name']) ?></b><small><?= e($p['summary']) ?></small></span>
      </a>
<?php endforeach; ?>
    </div>
  </div>
</section>

<section class="figures">
  <div class="wrap figures-grid">
    <div class="reveal"><b>4</b><span>business modules that share one database</span></div>
    <div class="reveal"><b>1</b><span>login per person, with access set by module</span></div>
    <div class="reveal"><b>30</b><span>days of automatic backups on your own computer</span></div>
    <div class="reveal"><b>0</b><span>copy and paste between spreadsheets</span></div>
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

<section class="section showcase">
  <div class="wrap">
    <p class="eyebrow reveal center">See it in action</p>
    <h2 class="section-title reveal">From a messy sheet to a live app</h2>
    <div class="slider reveal" data-slider>
      <div class="slider-tabs" role="tablist" aria-label="FlowSuit screens">
        <button type="button" role="tab" aria-selected="true"><span>Workbook to app</span><i></i></button>
        <button type="button" role="tab" aria-selected="false"><span>ERP dashboard</span><i></i></button>
        <button type="button" role="tab" aria-selected="false"><span>Inventory</span><i></i></button>
        <button type="button" role="tab" aria-selected="false"><span>Finance</span><i></i></button>
        <button type="button" role="tab" aria-selected="false"><span>Store</span><i></i></button>
      </div>
      <div class="slider-track" data-track tabindex="0" aria-label="Slides, swipe or use the arrow keys">
        <div class="slide" role="tabpanel" aria-roledescription="slide" aria-label="1 of 5">
          <div class="slide-text">
            <h3>Send us the file. Get back an app.</h3>
            <p>We read your stock register, ledger or price list, keep the way you work, and fix the broken formulas on the way.</p>
            <a class="card-link" href="/services/workbook-digitization">Workbook digitization <?= icon('arrow') ?></a>
          </div>
          <div class="slide-visual">
  <div class="transform" aria-hidden="true">
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
        </div>
        <div class="slide" role="tabpanel" aria-roledescription="slide" aria-label="2 of 5">
          <div class="slide-text">
            <h3>Your whole business on one screen.</h3>
            <p>Sales, stock and cash update live. Every staff member gets their own login and only sees what they need.</p>
            <a class="card-link" href="/products/erp">FlowSuit ERP <?= icon('arrow') ?></a>
          </div>
          <div class="slide-visual"><?php $mockTitle = 'FlowSuit ERP'; require __DIR__ . '/dashboard-mock.php'; ?></div>
        </div>
        <div class="slide" role="tabpanel" aria-roledescription="slide" aria-label="3 of 5">
          <div class="slide-text">
            <h3>Know what is on the shelf.</h3>
            <p>Stock goes down with every sale and up with every delivery. Low items are flagged before you run out.</p>
            <a class="card-link" href="/products/inventory">FlowSuit Inventory <?= icon('arrow') ?></a>
          </div>
          <div class="slide-visual">
            <div class="mock-app" aria-hidden="true">
              <div class="mock-bar"><span></span><span></span><span></span> FlowSuit Inventory</div>
              <table>
                <tr><th>Item</th><th>In stock</th><th>Status</th></tr>
                <tr><td>Cooking oil 5L</td><td>82</td><td><span class="pill pill-ok">OK</span></td></tr>
                <tr><td>Rice 10kg</td><td>64</td><td><span class="pill pill-ok">OK</span></td></tr>
                <tr><td>Sugar 1kg</td><td>18</td><td><span class="pill pill-low">Reorder</span></td></tr>
                <tr><td>Tea 950g</td><td>47</td><td><span class="pill pill-ok">OK</span></td></tr>
                <tr><td>Flour 20kg</td><td>12</td><td><span class="pill pill-low">Reorder</span></td></tr>
              </table>
            </div>
          </div>
        </div>
        <div class="slide" role="tabpanel" aria-roledescription="slide" aria-label="4 of 5">
          <div class="slide-text">
            <h3>Books that balance themselves.</h3>
            <p>Invoices, payments and expenses post to the accounts as they happen, so receivables and cash are always current.</p>
            <a class="card-link" href="/products/finance">FlowSuit Finance <?= icon('arrow') ?></a>
          </div>
          <div class="slide-visual">
            <div class="mock-app mock-fin" aria-hidden="true">
              <div class="mock-bar"><span></span><span></span><span></span> FlowSuit Finance</div>
              <div class="fin-body">
                <div class="donut" style="--p:72"><b>72%</b><small>collected</small></div>
                <ul>
                  <li><span>INV-1043</span><b>184,500</b><span class="pill pill-ok">Paid</span></li>
                  <li><span>INV-1044</span><b>62,300</b><span class="pill pill-low">Due</span></li>
                  <li><span>INV-1045</span><b>48,900</b><span class="pill pill-ok">Paid</span></li>
                  <li><span>INV-1046</span><b>21,750</b><span class="pill pill-low">Due</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div class="slide" role="tabpanel" aria-roledescription="slide" aria-label="5 of 5">
          <div class="slide-text">
            <h3>A till that keeps up with the counter.</h3>
            <p>Tap the items, take the payment, print the receipt. Stock and today's sales update in the same second.</p>
            <a class="card-link" href="/products/store">FlowSuit Store <?= icon('arrow') ?></a>
          </div>
          <div class="slide-visual">
            <div class="mock-app mock-pos" aria-hidden="true">
              <div class="mock-bar"><span></span><span></span><span></span> FlowSuit Store</div>
              <div class="pos-body">
                <div class="pos-items"><i style="--c:#1B3A5C">Tea</i><i style="--c:#1F6FB8">Rice</i><i style="--c:#0B8BD0">Oil</i><i style="--c:#38BDF8">Sugar</i><i style="--c:#334E6E">Flour</i><i style="--c:#F59E0B">Soap</i></div>
                <div class="pos-cart"><p><span>Tea 950g x2</span><b>1,980</b></p><p><span>Rice 10kg</span><b>3,450</b></p><p><span>Oil 5L</span><b>2,900</b></p><p class="pos-total"><span>Total</span><b>8,330</b></p><span class="pos-pay">Pay</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="slider-nav">
        <button type="button" class="slider-btn" data-prev aria-label="Previous slide"><?= icon('arrow') ?></button>
        <button type="button" class="slider-btn" data-next aria-label="Next slide"><?= icon('arrow') ?></button>
      </div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/home/demo.php'; ?>

<?php $video = (string) config('video_id'); if (preg_match('/^[\w-]{6,20}$/', $video)): ?>

<section class="section section-soft">
  <div class="wrap narrow center">
    <p class="eyebrow reveal center">Watch</p>
    <h2 class="section-title reveal">FlowSuit in two minutes</h2>
    <button type="button" class="video reveal" data-video="<?= e($video) ?>" style="background-image:url(https://i.ytimg.com/vi/<?= e($video) ?>/hqdefault.jpg)"><span class="video-play"><?= icon('arrow') ?></span><span class="sr-only">Play video</span></button>
  </div>
</section>
<?php endif; ?>

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
<?php
$orbit = [['boxes', 'Inventory', '/products/inventory'], ['ledger', 'Finance', '/products/finance'], ['store', 'Store', '/products/store'],
          ['chart', 'Reports', '/products/erp'], ['bolt', 'Automation', '/services/google-apps-script'], ['phone', 'Mobile apps', '/services/mobile-apps']];
?>
      <svg viewBox="0 0 400 400">
        <circle class="ring" cx="200" cy="200" r="150" />
        <circle class="ring ring-2" cx="200" cy="200" r="95" />
<?php foreach ($orbit as $k => $n): $ang = deg2rad(-90 + $k * 60); $x = round(200 + 150 * cos($ang), 1); $y = round(200 + 150 * sin($ang), 1); ?>
        <path id="ln-<?= $k ?>" class="link" d="M200 200 L<?= $x ?> <?= $y ?>" />
        <circle class="packet" r="4.5"><animateMotion dur="2.4s" begin="<?= $k * 0.4 ?>s" repeatCount="indefinite"<?= $k % 2 ? '' : ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' ?>><mpath href="#ln-<?= $k ?>"/></animateMotion></circle>
<?php endforeach; ?>
      </svg>
      <div class="node hub"><?= icon('erp') ?><b>FlowSuit ERP</b></div>
<?php foreach ($orbit as $k => [$ic, $label, $href]): $ang = deg2rad(-90 + $k * 60); ?>
      <div class="node" style="left:<?= round(50 + 37.5 * cos($ang), 2) ?>%;top:<?= round(50 + 37.5 * sin($ang), 2) ?>%;--k:<?= $k ?>"><?= icon($ic) ?><b><?= e($label) ?></b></div>
<?php endforeach; ?>
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

<section class="section section-charts">
  <div class="wrap">
    <p class="eyebrow reveal center">Reports</p>
    <h2 class="section-title reveal">See your numbers, not cells.</h2>
    <p class="section-lead reveal">Charts build themselves from the data you already enter. No formulas, no copy and paste.</p>
    <?php require __DIR__ . '/charts.php'; ?>
  </div>
</section>

<?php require __DIR__ . '/home/tables.php'; ?>

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

<?php require __DIR__ . '/home/security.php'; ?>

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

<section class="section mission-band">
  <div class="wrap narrow center">
    <span class="vm-icon pop reveal"><?= icon('target') ?></span>
    <p class="eyebrow reveal">Our mission</p>
    <p class="mission-quote reveal"><?= e(config('mission')) ?></p>
    <a class="card-link reveal" href="/about">Read about FlowSuit <?= icon('arrow') ?></a>
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <h2 class="reveal">Send us the workbook. Get back an app.</h2>
    <a class="button button-light reveal" href="<?= e($quote) ?>">Get a free review <?= icon('arrow') ?></a>
  </div>
</section>
