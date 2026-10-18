<?php $title = 'Sign in | ' . ERP_CLIENT_NAME . ' ERP'; $authTitle = 'Receivable & Recovery ERP'; $authLead = 'Sign in with the e-mail and password from your admin.'; ?>
<div class="auth-card">
<?php require __DIR__ . '/auth-brand.php'; ?>
<?php if ($error): ?>
  <p class="erp-error"><?= e($error) ?></p>
<?php endif; ?>
  <form method="post" class="form auth-form" data-busy>
    <?= erp_csrf_field() ?>
    <label>E-mail<input type="email" name="email" value="<?= e($email) ?>" autocomplete="username" required autofocus></label>
    <label>Password<span class="pw-wrap"><input type="password" name="password" autocomplete="current-password" required><button type="button" class="pw-eye" data-reveal aria-label="Show password"><?= icon('eye') ?></button></span></label>
    <div class="auth-row">
      <label class="check"><input type="checkbox" name="remember" value="1" checked> Remember me for 30 days</label>
      <a href="/erp/forgot">Forgot password?</a>
    </div>
    <button class="btn btn-gold" type="submit"><span>Sign in</span></button>
  </form>
  <p class="auth-foot">Untick "Remember me" on a shared computer. · <a href="/erp">&larr; All systems</a></p>
</div>
