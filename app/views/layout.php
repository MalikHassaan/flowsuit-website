<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($page['title']) ?></title>
  <meta name="description" content="<?= e($page['description']) ?>">
  <link rel="canonical" href="<?= e(url($page['path'])) ?>">
<?php if (!config('indexable')): ?>
  <meta name="robots" content="noindex, nofollow">
<?php endif; ?>
  <meta property="og:title" content="<?= e($page['title']) ?>">
  <meta property="og:description" content="<?= e($page['description']) ?>">
  <meta property="og:url" content="<?= e(url($page['path'])) ?>">
  <meta property="og:type" content="website">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="/assets/css/style.css">
<?php if (!empty($page['schema'])): ?>
  <script type="application/ld+json"><?= json_encode($page['schema'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
<?php endif; ?>
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="logo" href="/"><span class="logo-mark"><?= icon('sheet') ?></span><?= e(config('site_name')) ?></a>
      <nav>
        <a href="/products">Products</a>
        <a href="/services">Services</a>
        <a href="/pricing">Pricing</a>
        <a href="/contact">Contact</a>
        <a class="button button-small" href="/contact">Get a free quote</a>
      </nav>
    </div>
  </header>

  <main>
<?= $content ?>
  </main>

  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <a class="logo" href="/"><span class="logo-mark"><?= icon('sheet') ?></span><?= e(config('site_name')) ?></a>
        <p><?= e(config('tagline')) ?></p>
      </div>
      <div>
        <h4>Products</h4>
<?php foreach (products_of_type('product') as $p): ?>
        <a href="<?= e(product_path($p)) ?>"><?= e($p['name']) ?></a>
<?php endforeach; ?>
      </div>
      <div>
        <h4>Services</h4>
<?php foreach (products_of_type('service') as $p): ?>
        <a href="<?= e(product_path($p)) ?>"><?= e($p['name']) ?></a>
<?php endforeach; ?>
      </div>
      <div>
        <h4>Company</h4>
        <a href="/pricing">Pricing</a>
        <a href="/contact">Contact</a>
        <a href="mailto:<?= e(config('contact_email')) ?>"><?= e(config('contact_email')) ?></a>
      </div>
    </div>
    <div class="wrap footer-bottom">&copy; <?= date('Y') ?> <?= e(config('site_name')) ?>. <a href="/sitemap.xml">Sitemap</a></div>
  </footer>
</body>
</html>
