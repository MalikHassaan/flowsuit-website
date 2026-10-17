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
  <link rel="stylesheet" href="/assets/css/style.css">
<?php if (!empty($page['schema'])): ?>
  <script type="application/ld+json"><?= json_encode($page['schema'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
<?php endif; ?>
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="logo" href="/"><?= e(config('site_name')) ?></a>
      <nav>
        <a href="/software">Software</a>
        <a href="/pricing">Pricing</a>
        <a href="/contact">Contact</a>
      </nav>
    </div>
  </header>

  <main class="wrap">
<?= $content ?>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <p>&copy; <?= date('Y') ?> <?= e(config('site_name')) ?>. <a href="/sitemap.xml">Sitemap</a></p>
    </div>
  </footer>
</body>
</html>
