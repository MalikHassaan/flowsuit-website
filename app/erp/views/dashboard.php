<?php $title = 'Dashboard | FlowSuit ERP'; $active = 'home'; ?>
<header class="page-top">
  <div><h1>Welcome, <?= e(strtok($me['name'], ' ')) ?></h1><p class="muted">These are the parts of FlowSuit ERP you can open. Locked ones need access from your admin.</p></div>
</header>
<div class="mod-grid">
<?php $i = 0; foreach (erp_modules() as $key => $mod): $can = erp_can($me, $key); ?>
  <<?= $can ? 'a href="/erp/m/' . e($key) . '"' : 'div' ?> class="mod-card<?= $can ? '' : ' is-locked' ?>" style="--i:<?= $i++ ?>">
    <span class="mod-icon"><?= icon($can ? $mod['icon'] : 'lock') ?></span>
    <h2><?= e($mod['name']) ?></h2>
    <p><?= e($mod['about']) ?></p>
    <span class="tag<?= $can ? ' tag-ok' : '' ?>"><?= $can ? ($me['is_admin'] ? 'Admin' : e(ERP_LEVELS[$me['access'][$key]])) : 'No access' ?><?= $can && !$mod['ready'] ? ' · not set up yet' : '' ?></span>
  </<?= $can ? 'a' : 'div' ?>>
<?php endforeach; ?>
<?php if ($me['is_admin']): ?>
  <a href="/erp/users" class="mod-card mod-admin" style="--i:<?= $i ?>">
    <span class="mod-icon"><?= icon('users') ?></span>
    <h2>Users and access</h2>
    <p>Add team members and choose which parts each person can open.</p>
    <span class="tag tag-ok">Admin only</span>
  </a>
<?php endif; ?>
</div>
