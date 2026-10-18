<?php $title = 'No access | FlowSuit ERP'; ?>
<div class="empty">
  <span class="mod-icon big"><?= icon('lock') ?></span>
  <h1>You don't have access to <?= e($module['name'] ?? 'this page') ?></h1>
  <p class="muted">Ask your FlowSuit admin to turn it on for your account under Users and access.</p>
  <a class="btn" href="/erp">Back to dashboard</a>
</div>
