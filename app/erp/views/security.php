<?php $title = 'Security | FlowSuit ERP'; $active = 'security'; ?>
<header class="page-top">
  <div><h1>Security</h1><p class="muted">Extra protection for signing in.</p></div>
</header>
<?php if ($error): ?>
<p class="erp-error"><?= e($error) ?></p>
<?php endif; ?>
<section class="panel">
  <h2>E-mail code at sign-in (OTP) <span class="tag<?= $on ? ' tag-ok' : '' ?>"><?= $on ? 'On' : 'Off' ?></span></h2>
  <p class="muted">After the password, everyone types a 6-digit code sent to their e-mail. Devices with "Remember me" ticked skip the code for 30 days.</p>
<?php if ($forcedOff): ?>
  <p class="erp-error">Codes are switched off on the server ('erp_otp_off' in flowsuit-secrets.php). Remove that line to use them.</p>
<?php elseif ($on): ?>
  <form method="post" data-confirm="Turn off sign-in codes for everyone?">
    <?= erp_csrf_field() ?><input type="hidden" name="action" value="off">
    <button class="btn btn-ghost" type="submit">Turn off</button>
  </form>
<?php elseif ($testing): ?>
  <p>We sent a test code to <b><?= e($me['email']) ?></b>. Type it here to prove e-mail works, and codes switch on.</p>
  <form method="post" class="form otp-test">
    <?= erp_csrf_field() ?><input type="hidden" name="action" value="confirm">
    <label>Test code<input class="otp-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required autofocus></label>
    <button class="btn" type="submit">Confirm and turn on</button>
  </form>
  <form method="post"><?= erp_csrf_field() ?><input type="hidden" name="action" value="test"><button class="linkbtn" type="submit">Send the test code again</button></form>
<?php else: ?>
  <p>First we send a test code to your own e-mail, <b><?= e($me['email']) ?></b>. Codes only switch on once you type it back, so a mail problem cannot lock everyone out.</p>
  <form method="post"><?= erp_csrf_field() ?><input type="hidden" name="action" value="test"><button class="btn" type="submit">Send me a test code</button></form>
<?php endif; ?>
  <p class="muted small">Locked out? In cPanel, add <code>'erp_otp_off' =&gt; true,</code> to flowsuit-secrets.php to switch codes off.</p>
</section>
