<?php $title = 'Dashboard | FlowSuit ERP'; $active = 'home'; ?>
<header class="page-top">
  <div><h1>Welcome, <?= e(strtok($me['name'], ' ')) ?></h1><p class="muted">These are the parts of FlowSuit ERP you can open.</p></div>
</header>
<div class="mod-grid">
<?php $i = 0; foreach (erp_live_modules() as $key => $mod): if (!erp_can($me, $key)) continue; ?>
  <a href="/erp/m/<?= e($key) ?>" class="mod-card" style="--i:<?= $i++ ?>">
    <span class="mod-icon"><?= icon($mod['icon']) ?></span>
    <h2><?= e($mod['name']) ?></h2>
    <p><?= e($mod['about']) ?></p>
  </a>
<?php endforeach; ?>
<?php if ($i === 0 && !$me['is_admin']): ?>
  <div class="empty"><h2>Nothing to open yet</h2><p class="muted">Ask your admin to give you access to a part of the ERP.</p></div>
<?php endif; ?>
</div>
