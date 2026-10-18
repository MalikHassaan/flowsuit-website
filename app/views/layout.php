<!doctype html>
<html lang="en" class="no-js">
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
  <meta property="og:type" content="<?= e($page['og_type'] ?? 'website') ?>">
  <meta property="og:site_name" content="<?= e(config('site_name')) ?>">
  <meta property="og:image" content="<?= e(url('/assets/og-image.png')) ?>">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#4f46e5">
  <link rel="apple-touch-icon" href="/assets/logo/apple-touch-icon.png">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="/assets/css/style.css">
  <script src="/assets/js/main.js" defer></script>
<?php foreach ($page['schema'] ?? [] as $schema): ?>
  <script type="application/ld+json"><?= json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
<?php endforeach; ?>
</head>
<body>
  <div class="scroll-progress" aria-hidden="true"></div>
  <header class="site-header">
    <div class="wrap">
      <a class="logo logo-anim" href="/" aria-label="<?= e(config('site_name')) ?> home"><?= logo_svg() ?></a>
      <nav>
        <a href="/products">Products</a>
        <a href="/services">Services</a>
        <a href="/guides">Guides</a>
        <a href="/about">About</a>
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
        <a class="logo" href="/"><img src="/assets/logo/flowsuit-logo-white.svg" alt="<?= e(config('site_name')) ?>" width="152" height="36"></a>
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
        <a href="/about">About FlowSuit</a>
        <a href="/guides">Guides</a>
        <a href="/contact">Contact</a>
        <a href="mailto:<?= e(config('contact_email')) ?>"><?= e(config('contact_email')) ?></a>
      </div>
    </div>
    <div class="wrap footer-bottom">&copy; <?= date('Y') ?> <?= e(config('site_name')) ?>. <a href="/sitemap.xml">Sitemap</a></div>
  </footer>

  <div class="chat" data-chat>
    <button class="chat-toggle" type="button" aria-expanded="false" aria-controls="chat-panel" data-chat-toggle>
      <?= icon('chat') ?><span>Chat with us</span>
    </button>
    <section class="chat-panel" id="chat-panel" role="dialog" aria-label="FlowSuit assistant" hidden>
      <header class="chat-head">
        <img src="/assets/logo/flowsuit-mark.svg" alt="" width="34" height="34">
        <div><strong>FlowSuit assistant</strong><span><i></i> Online now</span></div>
        <button type="button" class="chat-close" aria-label="Close chat" data-chat-toggle><?= icon('cross') ?></button>
      </header>
      <div class="chat-log" aria-live="polite" data-chat-log>
        <p class="msg msg-bot">Hi! Ask me anything about FlowSuit, turning workbooks into software, or our services.</p>
      </div>
      <div class="chat-chips" data-chat-chips>
        <button type="button">What is FlowSuit ERP?</button>
        <button type="button">How much does it cost?</button>
        <button type="button">Can you automate Google Sheets?</button>
      </div>
      <form class="chat-form" data-chat-form>
        <label class="sr-only" for="chat-input">Your message</label>
        <input id="chat-input" name="message" type="text" maxlength="1000" autocomplete="off" placeholder="Type your question..." required>
        <button type="submit" aria-label="Send"><?= icon('send') ?></button>
      </form>
      <p class="chat-foot"><?= icon('mail') ?> Or email <a href="mailto:<?= e(config('contact_email')) ?>"><?= e(config('contact_email')) ?></a></p>
    </section>
  </div>
</body>
</html>
