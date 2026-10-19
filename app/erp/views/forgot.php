<?php $title = 'Forgot password | ' . erp_client_name() . ' ERP'; $authTitle = 'Forgot your password?'; $authLead = $done ? '' : 'Enter the e-mail you sign in with. We will send you a 6-digit code and a link to choose a new password.'; ?>
<div class="auth-card">
<?php require __DIR__ . '/auth-brand.php'; ?>
<?php if ($error): ?>
  <p class="erp-error"><?= e($error) ?></p>
<?php endif; ?>
<?php if ($done): ?>
  <div class="auth-done"><span class="auth-tick"><?= icon('check') ?></span>
    <p>If <b><?= e($email) ?></b> has an account, a 6-digit code and a reset link are on their way. It works for <?= ERP_RESET_MINUTES ?> minutes. Check your spam folder too.</p>
    <p class="muted">No e-mail after a few minutes? Ask your admin to send you a link from Users and access.</p></div>
  <form method="post" class="form auth-form" data-busy>
    <?= erp_csrf_field() ?>
    <input type="hidden" name="action" value="code">
    <input type="hidden" name="email" value="<?= e($email) ?>">
    <label>Or type the 6-digit code from the e-mail<input class="otp-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required></label>
    <button class="btn btn-gold" type="submit"><span>Continue</span></button>
  </form>
<?php else: ?>
  <form method="post" class="form auth-form" data-busy>
    <?= erp_csrf_field() ?>
    <label>E-mail<input type="email" name="email" value="<?= e($email) ?>" autocomplete="username" required autofocus></label>
    <button class="btn btn-gold" type="submit"><span>Send me a code</span></button>
  </form>
  <p class="muted small">Forgot which e-mail you use? Your user ID is the e-mail your admin added you with. Ask your admin, who can see it in Users and access.</p>
<?php endif; ?>
  <p class="auth-foot"><a href="/erp/login">&larr; Back to sign in</a></p>
</div>
