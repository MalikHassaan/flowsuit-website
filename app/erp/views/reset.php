<?php $invite = $row && $row['token_kind'] === 'invite';
$title = 'Choose a password | ' . erp_client_name() . ' ERP';
$authTitle = $row ? ($invite ? 'Welcome, ' . strtok($row['name'], ' ') : 'Choose a new password') : 'This link does not work';
$authLead = $row ? ($invite ? 'Choose a password for ' . $row['email'] . ' to finish setting up your account.' : 'For ' . $row['email'] . '.') : 'It has expired or was already used. Ask for a new one.'; ?>
<div class="auth-card">
<?php require __DIR__ . '/auth-brand.php'; ?>
<?php foreach ($errors as $err): ?>
  <p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>
<?php if ($row): ?>
  <form method="post" class="form auth-form" data-busy>
    <?= erp_csrf_field() ?>
    <input type="hidden" name="t" value="<?= e($token) ?>">
    <label>New password (10+ characters)<span class="pw-wrap"><input type="password" name="password" minlength="10" autocomplete="new-password" required autofocus data-strength><button type="button" class="pw-eye" data-reveal aria-label="Show password"><?= icon('eye') ?></button></span></label>
    <div class="pw-meter" aria-hidden="true"><i></i></div>
    <label>Type it again<input type="password" name="confirm" minlength="10" autocomplete="new-password" required></label>
    <button class="btn btn-gold" type="submit"><span><?= $invite ? 'Save password and sign in' : 'Save new password' ?></span></button>
  </form>
<?php else: ?>
  <a class="btn btn-gold" href="/erp/forgot"><span>Send me a new link</span></a>
<?php endif; ?>
  <p class="auth-foot"><a href="/erp/login">&larr; Back to sign in</a></p>
</div>
