<?php $quote = 'mailto:' . config('contact_email') . '?subject=' . rawurlencode('Digitize my workbook'); ?>
<section class="hero about-hero">
  <div class="hero-bg" aria-hidden="true"><span class="blob blob-1"></span><span class="blob blob-2"></span><span class="grid-lines"></span></div>
  <div class="wrap hero-grid">
    <div>
      <p class="crumbs anim-up"><a href="/">Home</a> / About</p>
      <p class="eyebrow anim-up d1">About FlowSuit</p>
      <h1 class="anim-up d2">We turn the workbooks you trust into <span class="text-gradient">software you can grow on.</span></h1>
      <p class="lead anim-up d3">FlowSuit helps small and growing businesses move from Excel workbooks, Google Sheets and paper registers to secure software for inventory, finance and sales. We keep the logic that already works and remove the copy and paste.</p>
      <div class="actions anim-up d4">
        <a class="button button-shine" href="<?= e($quote) ?>">Get a free quote <?= icon('arrow') ?></a>
        <a class="button button-ghost" href="/products">See our products</a>
      </div>
    </div>
    <div class="journey anim-up d3" aria-hidden="true">
      <div class="journey-step js1"><span><?= icon('ledger') ?></span><b>Paper registers</b><small>Hard to share, easy to lose</small></div>
      <i class="journey-link"></i>
      <div class="journey-step js2"><span><?= icon('sheet') ?></span><b>Spreadsheets</b><small>Many copies, broken formulas</small></div>
      <i class="journey-link"></i>
      <div class="journey-step js3 is-goal"><span><?= icon('erp') ?></span><b>FlowSuit</b><small>One live system for the team</small></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div>
      <p class="eyebrow reveal">Overview</p>
      <h2 class="reveal">Built for businesses that run on spreadsheets.</h2>
      <p class="lead reveal">Most small businesses start with a workbook. It works until the team grows, the file gets copied, and one wrong formula changes the month's numbers. FlowSuit takes that workbook and rebuilds it as a shared application with logins, permissions and live reports.</p>
      <ul class="ticks">
        <li class="reveal"><?= icon('check') ?>Inventory, finance, store and full ERP products</li>
        <li class="reveal"><?= icon('check') ?>Workbook digitization and Google Apps Script automation</li>
        <li class="reveal"><?= icon('check') ?>Mobile apps, websites and SEO for growing teams</li>
      </ul>
    </div>
    <div class="about-tiles">
<?php foreach ([['boxes', 'Inventory'], ['ledger', 'Finance'], ['store', 'Store'], ['erp', 'ERP'], ['bolt', 'Automation'], ['phone', 'Mobile apps']] as $i => [$ic, $label]): ?>
      <div class="about-tile pop" style="--i:<?= $i ?>"><?= icon($ic) ?><span><?= e($label) ?></span></div>
<?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section section-dark">
  <div class="wrap">
    <h2 class="section-title reveal">Vision and mission</h2>
    <div class="vm-grid">
      <article class="vm-card pop reveal">
        <span class="vm-icon"><?= icon('eye') ?></span>
        <p class="eyebrow">Our vision</p>
        <h3><?= e(config('vision')) ?></h3>
      </article>
      <article class="vm-card pop reveal">
        <span class="vm-icon"><?= icon('target') ?></span>
        <p class="eyebrow">Our mission</p>
        <h3><?= e(config('mission')) ?></h3>
      </article>
    </div>
  </div>
</section>

<section class="section section-soft">
  <div class="wrap">
    <h2 class="section-title reveal">What we stand for</h2>
    <p class="section-lead reveal">Four promises we make to every customer.</p>
    <div class="grid-4">
<?php foreach ([
    ['sheet', 'Keep what works', 'Your workbook already holds years of know-how. We carry its rules into the software instead of starting over.'],
    ['chart', 'Clarity over complexity', 'Simple screens and live reports that the whole team understands, not another tool that needs a manual.'],
    ['lock', 'Your data is yours', 'Secure logins, roles for every staff member and regular backups. You can export everything at any time.'],
    ['users', 'Built with you', 'We review your workbook for free, show you each step, and train your team before you switch.'],
] as [$ic, $title, $text]): ?>
      <div class="card reveal"><span class="card-icon"><?= icon($ic) ?></span><h3><?= e($title) ?></h3><p><?= e($text) ?></p></div>
<?php endforeach; ?>
    </div>
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <h2 class="reveal">Send us the workbook. Get back an app.</h2>
    <a class="button button-light reveal" href="<?= e($quote) ?>">Get a free quote <?= icon('arrow') ?></a>
  </div>
</section>
