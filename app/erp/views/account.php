<?php $title = 'Change password | FlowSuit ERP'; $active = 'account'; ?>
<header class="page-top">
  <div><h1>Change password</h1><p class="muted"><?= $me['must_change'] ? 'Your admin asked you to choose your own password before you continue.' : 'Signed in as ' . e($me['email']) . '.' ?></p></div>
</header>
<?php foreach ($errors as $err): ?>
<p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>
<form method="post" class="panel form account-form">
  <?= erp_csrf_field() ?>
  <label>Current password<span class="pw-wrap"><input type="password" name="current" autocomplete="current-password" required autofocus><button type="button" class="pw-eye" data-reveal aria-label="Show password"><?= icon('eye') ?></button></span></label>
  <label>New password (10+ characters)<input type="password" name="password" minlength="10" autocomplete="new-password" required data-strength></label>
  <div class="pw-meter" aria-hidden="true"><i></i></div>
  <label>Type it again<input type="password" name="confirm" minlength="10" autocomplete="new-password" required></label>
  <p class="muted small">Saving signs you out on your other devices.</p>
  <div class="form-actions"><button class="btn" type="submit">Save new password</button><?php if (!$me['must_change']): ?><a href="/erp">Cancel</a><?php endif; ?></div>
</form>
