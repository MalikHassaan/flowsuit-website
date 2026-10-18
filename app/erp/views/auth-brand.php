<div class="auth-brand">
  <span class="auth-crest"><img src="/erp/brand-logo" alt="" width="96" height="96"></span>
  <p class="auth-client"><?= e(ERP_CLIENT_NAME) ?></p>
  <h1><?= e($authTitle) ?></h1>
<?php if (!empty($authLead)): ?>
  <p class="auth-lead"><?= e($authLead) ?></p>
<?php endif; ?>
</div>
