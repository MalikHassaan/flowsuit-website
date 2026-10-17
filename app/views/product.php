<p class="crumbs"><a href="/software">Software</a> / <?= e($product['category']) ?></p>
<h1><?= e($product['name']) ?></h1>
<p class="lead"><?= e($product['description']) ?></p>
<p>
  <span class="badge badge-<?= e($product['status']) ?>"><?= e(status_label($product['status'])) ?></span>
</p>
<p>
<?php if (!empty($product['app_url'])): ?>
  <a class="button" href="<?= e($product['app_url']) ?>">Open <?= e($product['name']) ?></a>
<?php else: ?>
  <a class="button" href="mailto:<?= e(config('contact_email')) ?>?subject=<?= rawurlencode('Notify me: ' . $product['name']) ?>">Tell me when it launches</a>
<?php endif; ?>
</p>

<section>
  <h2>Features</h2>
  <ul>
<?php foreach ($product['features'] as $feature): ?>
    <li><?= e($feature) ?></li>
<?php endforeach; ?>
  </ul>
</section>

<?php if (!empty($product['use_cases'])): ?>
<section>
  <h2>Who it is for</h2>
  <ul>
<?php foreach ($product['use_cases'] as $useCase): ?>
    <li><?= e($useCase) ?></li>
<?php endforeach; ?>
  </ul>
</section>
<?php endif; ?>

<?php if (!empty($product['alternatives'])): ?>
<section>
  <h2>A simpler alternative to</h2>
  <p><?= e(implode(', ', $product['alternatives'])) ?></p>
</section>
<?php endif; ?>
