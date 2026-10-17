<?php
$isService = $product['type'] === 'service';
$mail = 'mailto:' . config('contact_email') . '?subject=' . rawurlencode(($isService ? 'Quote: ' : 'Demo: ') . $product['name']);
?>
<section class="page-head">
  <div class="wrap product-hero">
    <div>
      <p class="crumbs reveal"><a href="<?= $isService ? '/services' : '/products' ?>"><?= $isService ? 'Services' : 'Products' ?></a> / <?= e($product['category']) ?></p>
      <span class="card-icon card-icon-large reveal"><?= icon($product['icon']) ?></span>
      <h1 class="reveal"><?= e($product['name']) ?></h1>
      <p class="lead reveal"><?= e($product['description']) ?></p>
      <div class="actions reveal">
<?php if (!empty($product['app_url'])): ?>
        <a class="button" href="<?= e($product['app_url']) ?>">Open <?= e($product['name']) ?></a>
<?php endif; ?>
        <a class="button<?= !empty($product['app_url']) ? ' button-ghost' : '' ?>" href="<?= e($mail) ?>"><?= $isService ? 'Get a free quote' : 'Request a demo' ?></a>
      </div>
    </div>
<?php if (!$isService): ?>
    <div class="reveal"><?php $mockTitle = $product['name']; require __DIR__ . '/dashboard-mock.php'; ?></div>
<?php endif; ?>
  </div>
</section>

<section class="section section-tight">
  <div class="wrap with-sidebar">
<?php require __DIR__ . '/sidebar.php'; ?>
    <div>
      <h2>What you get</h2>
      <div class="feature-grid">
<?php foreach ($product['features'] as $feature): ?>
        <div class="feature reveal"><?= icon('check') ?><span><?= e($feature) ?></span></div>
<?php endforeach; ?>
      </div>

<?php if (!empty($product['use_cases'])): ?>
      <h2>Who it is for</h2>
      <ul class="ticks">
<?php foreach ($product['use_cases'] as $useCase): ?>
        <li class="reveal"><?= icon('check') ?><?= e($useCase) ?></li>
<?php endforeach; ?>
      </ul>
<?php endif; ?>

<?php if (!empty($product['alternatives'])): ?>
      <h2>Replaces</h2>
      <p class="reveal"><?= e(implode(', ', $product['alternatives'])) ?></p>
<?php endif; ?>

      <div class="inline-cta reveal">
        <div>
          <strong><?= $isService ? 'Tell us what you need' : 'See ' . e($product['name']) . ' with your own data' ?></strong>
          <span>Send us your workbook. We reply with a free review and next steps.</span>
        </div>
        <a class="button" href="<?= e($mail) ?>"><?= $isService ? 'Get a free quote' : 'Request a demo' ?></a>
      </div>
    </div>
  </div>
</section>
