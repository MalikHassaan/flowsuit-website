<?php $title = 'Sign in | ' . erp_client_name() . ' ERP'; $authTitle = ['hsec' => 'HSEC ERP', 'taj' => 'Receivable & Recovery ERP'][erp_system()] ?? 'Sign in to your ERP'; $authLead = erp_system() === 'flowsuit' ? 'One sign-in for every FlowSuit system. Your account opens your company\'s ERP straight away.' : 'Sign in with the e-mail and password from your admin.'; ?>
<div class="auth-card">
<?php require __DIR__ . '/auth-brand.php'; ?>
<?php if (!$error && !empty($_GET['idle'])): ?>
  <p class="erp-note">You were signed out after 10 minutes without activity. Sign in again to continue.</p>
<?php endif; ?>
<?php if ($error): ?>
  <p class="erp-error"><?= e($error) ?></p>
<?php endif; ?>
  <form method="post" class="form auth-form" data-busy>
    <?= erp_csrf_field() ?>
    <label>E-mail<input type="email" name="email" value="<?= e($email) ?>" autocomplete="username" required autofocus></label>
    <label>Password<span class="pw-wrap"><input type="password" name="password" autocomplete="current-password" required><button type="button" class="pw-eye" data-reveal aria-label="Show password"><?= icon('eye') ?></button></span></label>
    <div class="auth-row">
      <span class="muted">Signs out after 10 minutes without activity.</span>
      <a href="/erp/forgot">Forgot password?</a>
    </div>
    <button class="btn btn-gold auth-go" type="submit"><span>Sign in</span></button>
  </form>
  <p class="auth-foot"><a href="/">&larr; FlowSuit website</a></p>
</div>
