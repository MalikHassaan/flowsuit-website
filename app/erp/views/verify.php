<?php $title = 'Enter your code | ' . ERP_CLIENT_NAME . ' ERP'; $authTitle = 'Check your e-mail'; $authLead = 'We sent a 6-digit code to ' . $email . '. It works for ' . ERP_OTP_MINUTES . ' minutes.'; ?>
<div class="auth-card">
<?php require __DIR__ . '/auth-brand.php'; ?>
<?php if ($error): ?>
  <p class="erp-error"><?= e($error) ?></p>
<?php elseif ($notice): ?>
  <p class="erp-flash"><?= e($notice) ?></p>
<?php endif; ?>
  <form method="post" class="form auth-form" data-busy>
    <?= erp_csrf_field() ?>
    <label>Sign-in code<input class="otp-input" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" placeholder="••••••" required autofocus></label>
    <button class="btn btn-gold" type="submit"><span>Verify and sign in</span></button>
  </form>
  <form method="post" class="auth-resend">
    <?= erp_csrf_field() ?>
    <input type="hidden" name="action" value="resend">
    <span class="muted small">No e-mail? Check spam, or</span> <button type="submit" class="linkbtn">send a new code</button>
  </form>
  <p class="auth-foot"><a href="/erp/login">&larr; Use a different account</a></p>
</div>
