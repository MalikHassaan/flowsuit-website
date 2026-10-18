<?php $title = 'Sign in | FlowSuit ERP'; ?>
<div class="auth-card">
  <a href="/" class="auth-logo"><img src="/assets/logo/flowsuit-logo.svg" alt="FlowSuit" width="152" height="36"></a>
  <h1>Sign in to FlowSuit ERP</h1>
  <p class="muted">Use the email and password your admin gave you.</p>
<?php if ($error): ?>
  <p class="erp-error"><?= e($error) ?></p>
<?php endif; ?>
  <form method="post" class="form">
    <?= erp_csrf_field() ?>
    <label>Email<input type="email" name="email" value="<?= e($email) ?>" autocomplete="username" required autofocus></label>
    <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
    <button class="btn" type="submit">Sign in</button>
  </form>
  <p class="muted small">Forgot your password? Ask your admin to set a new one.</p>
</div>
