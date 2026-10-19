<div class="auth-brand">
  <span class="auth-crest<?= erp_system() === 'hsec' ? ' is-hsec' : '' ?>"><img src="<?= erp_system() === 'hsec' ? '/erp/hsec-logo' : '/erp/brand-logo' ?>" alt="" width="96" height="96"></span>
  <p class="auth-client"><?= e(erp_client_name()) ?></p>
  <h1><?= e($authTitle) ?></h1>
<?php if (!empty($authLead)): ?>
  <p class="auth-lead"><?= e($authLead) ?></p>
<?php endif; ?>
</div>
