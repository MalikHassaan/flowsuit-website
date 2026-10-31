<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title><?= e($title ?? 'FlowSuit ERP') ?></title>
  <meta name="theme-color" content="#1F6FB8">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/erp.css?v=16">
</head>
<body class="<?= $user ? 'erp-app' : 'erp-auth' ?>">
<?php if ($user): ?>
  <aside class="erp-side">
    <a class="erp-brand" href="/erp"><img src="/assets/logo/flowsuit-logo-white.svg" alt="FlowSuit" width="136" height="32"><span>ERP</span></a>
    <nav>
      <a href="/erp" class="<?= ($active ?? '') === 'home' ? 'is-on' : '' ?>"><?= icon('erp') ?>Dashboard</a>
<?php foreach (erp_live_modules() as $key => $mod): ?>
<?php if (erp_can($user, $key)): ?>
      <a href="/erp/m/<?= e($key) ?>" class="<?= ($active ?? '') === $key ? 'is-on' : '' ?>"><?= icon($mod['icon']) ?><?= e($mod['name']) ?></a>
<?php endif; ?>
<?php endforeach; ?>
<?php if ($user['is_admin']): ?>
      <a href="/erp/users" class="<?= ($active ?? '') === 'users' ? 'is-on' : '' ?>"><?= icon('users') ?>Users and access</a>
      <a href="/erp/analytics" class="<?= ($active ?? '') === 'analytics' ? 'is-on' : '' ?>"><?= icon('chart') ?>Website visitors</a>
      <a href="/erp/chat-log" class="<?= ($active ?? '') === 'chat-log' ? 'is-on' : '' ?>"><?= icon('chat') ?>Chat log</a>
      <a href="/erp/help-notes" class="<?= ($active ?? '') === 'help-notes' ? 'is-on' : '' ?>"><?= icon('bolt') ?>AI assistant</a>
      <a href="/erp/backups" class="<?= ($active ?? '') === 'backups' ? 'is-on' : '' ?>"><?= icon('cloud') ?>Backups</a>
      <a href="/erp/security" class="<?= ($active ?? '') === 'security' ? 'is-on' : '' ?>"><?= icon('shield') ?>Security</a>
<?php endif; ?>
    </nav>
    <div class="erp-me">
      <span class="avatar"><?= e(mb_strtoupper(mb_substr($user['name'], 0, 1))) ?></span>
      <div><b><?= e($user['name']) ?></b><small><?= $user['is_admin'] ? 'Admin' : 'Team member' ?> · <a href="/erp/account">Change password</a> · <a href="/erp/switch" target="_blank" rel="noopener" title="Sign in to another account in a new tab. This tab stays signed in.">Use another account</a></small></div>
      <form method="post" action="/erp/logout"><?= erp_csrf_field() ?><button type="submit" title="Sign out">Sign out</button></form>
    </div>
  </aside>
<?php endif; ?>
<?php if (!$user): ?>
  <div class="auth-bg" aria-hidden="true"><b class="glow g1"></b><b class="glow g2"></b><b class="glow g3"></b><?php foreach ([[8, 12], [22, 70], [35, 25], [48, 82], [62, 15], [74, 60], [86, 30], [92, 78], [15, 45], [55, 48], [80, 8], [28, 90]] as $n => [$x, $y]): ?><b class="tw" style="left:<?= $x ?>%;top:<?= $y ?>%;animation-delay:-<?= $n * .45 ?>s"></b><?php endforeach; ?><?php foreach ([[64, 1, 3.8, 3.8], [66, 59, 4.3, 0.6], [73, 6, 5.4, 0.4], [92, 2, 5.5, 2.8], [48, 32, 5.0, 3.8], [93, 8, 5.5, 4.5], [67, 2, 5.7, 3.5], [82, 54, 5.5, 3.2], [58, 26, 3.8, 2.1], [76, 31, 5.6, 0.5], [85, 38, 4.0, 3.4], [25, 35, 4.7, 2.5], [92, 3, 6.4, 6.6], [80, 2, 6.1, 2.2], [98, 31, 6.0, 6.2], [56, 40, 4.1, 0.8], [68, 11, 6.1, 2.8], [83, 52, 4.9, 1.9], [82, 48, 7.0, 4.8], [68, 5, 4.1, 1.6]] as [$x, $y, $d, $w]): ?><i style="--x:<?= $x ?>%;--y:<?= $y ?>%;--d:<?= $d ?>s;--w:-<?= $w ?>s"></i><?php endforeach; ?></div>
<?php endif; ?>
  <main class="erp-main">
<?php if ($flash): ?>
    <p class="erp-flash"><?= icon('check') ?><?= e($flash) ?></p>
<?php endif; ?>
<?= $content ?>
  </main>
  <script src="/assets/js/erp.js?v=3" defer></script>
<?php if ($user): ?>
  <?= chat_inject($user) ?>
<?php endif; ?>
</body>
</html>
