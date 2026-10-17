<?php
$isService = $product['type'] === 'service';
$subject = ($isService ? 'Quote: ' : 'Notify me: ') . $product['name'];
?>
<section class="section">
  <div class="wrap narrow">
    <p class="crumbs"><a href="<?= $isService ? '/services' : '/software' ?>"><?= $isService ? 'Services' : 'Modules' ?></a> / <?= e($product['category']) ?></p>
    <span class="card-icon card-icon-large"><?= icon($product['icon']) ?></span>
    <h1><?= e($product['name']) ?></h1>
    <p class="lead"><?= e($product['description']) ?></p>
    <p><span class="badge badge-<?= e($product['status']) ?>"><?= e(status_label($product['status'])) ?></span></p>
    <div class="actions">
<?php if (!empty($product['app_url'])): ?>
      <a class="button" href="<?= e($product['app_url']) ?>">Open <?= e($product['name']) ?></a>
<?php elseif ($isService): ?>
      <a class="button" href="mailto:<?= e(config('contact_email')) ?>?subject=<?= rawurlencode($subject) ?>">Get a free quote</a>
<?php else: ?>
      <a class="button" href="mailto:<?= e(config('contact_email')) ?>?subject=<?= rawurlencode($subject) ?>">Get early access</a>
<?php endif; ?>
    </div>

    <h2>What you get</h2>
    <ul class="ticks">
<?php foreach ($product['features'] as $feature): ?>
      <li><?= icon('check') ?><?= e($feature) ?></li>
<?php endforeach; ?>
    </ul>

<?php if (!empty($product['use_cases'])): ?>
    <h2>Who it is for</h2>
    <ul class="ticks">
<?php foreach ($product['use_cases'] as $useCase): ?>
      <li><?= icon('check') ?><?= e($useCase) ?></li>
<?php endforeach; ?>
    </ul>
<?php endif; ?>

<?php if (!empty($product['alternatives'])): ?>
    <h2>Replaces</h2>
    <p><?= e(implode(', ', $product['alternatives'])) ?></p>
<?php endif; ?>
  </div>
</section>
