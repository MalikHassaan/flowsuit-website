<?php $title = 'Dashboard | FlowSuit ERP'; $active = 'home'; ?>
<header class="page-top">
  <div><h1>Welcome, <?= e(strtok($me['name'], ' ')) ?></h1><p class="muted">These are the parts of FlowSuit ERP you can open.</p></div>
</header>
<div class="mod-grid">
<?php $i = 0; foreach (erp_modules() as $key => $mod): if (!erp_can($me, $key)) continue; ?>
  <a href="/erp/m/<?= e($key) ?>" class="mod-card" style="--i:<?= $i++ ?>">
    <span class="mod-icon"><?= icon($mod['icon']) ?></span>
    <h2><?= e($mod['name']) ?></h2>
    <p><?= e($mod['about']) ?></p>
    <span class="tag tag-ok"><?= $me['is_admin'] ? 'Admin' : e(ERP_LEVELS[$me['access'][$key]]) ?><?= !$mod['ready'] ? ' · not set up yet' : '' ?></span>
  </a>
<?php endforeach; ?>
<?php if ($i === 0 && !$me['is_admin']): ?>
  <div class="empty"><h2>Nothing to open yet</h2><p class="muted">Ask your admin to give you access to a part of the ERP.</p></div>
<?php endif; ?>
<?php if ($me['is_admin']): ?>
  <a href="/erp/users" class="mod-card mod-admin" style="--i:<?= $i ?>">
    <span class="mod-icon"><?= icon('users') ?></span>
    <h2>Users and access</h2>
    <p>Add team members and choose which parts each person can open.</p>
    <span class="tag tag-ok">Admin only</span>
  </a>
<?php endif; ?>
</div>
