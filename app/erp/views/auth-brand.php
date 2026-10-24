<div class="auth-brand">
<?php if (erp_system() === 'flowsuit'): ?>
  <span class="auth-mark" aria-hidden="true"><svg viewBox="0 0 48 48" width="84" height="84"><rect width="22" height="22" rx="6" fill="#1B3A5C"/><rect x="26" width="22" height="22" rx="6" fill="#1F6FB8"/><rect y="26" width="22" height="22" rx="6" fill="#38BDF8"/><circle cx="37" cy="37" r="11" fill="#F59E0B"/></svg></span>
<?php else: ?>
  <span class="auth-crest<?= erp_system() === 'hsec' ? ' is-hsec' : '' ?>"><img src="<?= erp_system() === 'hsec' ? '/erp/hsec-logo' : '/erp/brand-logo' ?>" alt="" width="96" height="96"></span>
<?php endif; ?>
  <p class="auth-client"><?= e(erp_client_name()) ?></p>
  <h1><?= e($authTitle) ?></h1>
<?php if (!empty($authLead)): ?>
  <p class="auth-lead"><?= e($authLead) ?></p>
<?php endif; ?>
</div>
