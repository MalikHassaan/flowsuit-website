<?php $current = $page['path']; ?>
<aside class="side-panel">
  <div class="side-group">
    <a class="side-title<?= $current === '/products' ? ' is-active' : '' ?>" href="/products">Products</a>
<?php foreach (products_of_type('product') as $p): ?>
    <a class="side-link<?= $current === product_path($p) ? ' is-active' : '' ?>" href="<?= e(product_path($p)) ?>"><?= icon($p['icon']) ?><?= e($p['name']) ?></a>
<?php endforeach; ?>
  </div>
  <div class="side-group">
    <a class="side-title<?= $current === '/services' ? ' is-active' : '' ?>" href="/services">Services</a>
<?php foreach (products_of_type('service') as $p): ?>
    <a class="side-link<?= $current === product_path($p) ? ' is-active' : '' ?>" href="<?= e(product_path($p)) ?>"><?= icon($p['icon']) ?><?= e($p['name']) ?></a>
<?php endforeach; ?>
  </div>
  <div class="side-cta">
    <strong>Free workbook review</strong>
    <span>Send us your file and get a fixed quote.</span>
    <a class="button button-small" href="mailto:<?= e(config('contact_email')) ?>?subject=<?= rawurlencode('Digitize my workbook') ?>">Get started</a>
  </div>
</aside>
