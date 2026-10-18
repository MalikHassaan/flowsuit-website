<?php $title = 'Set up | FlowSuit ERP'; ?>
<div class="auth-card">
  <a href="/" class="auth-logo"><img src="/assets/logo/flowsuit-logo.svg" alt="FlowSuit" width="152" height="36"></a>
  <h1>Create the first admin</h1>
<?php if (!$hasCode): ?>
  <p class="muted">Setup is locked until a setup code is saved on the server. This stops strangers from creating the first account.</p>
  <ol class="steps-list">
    <li>In cPanel, open <b>File Manager</b> and go to your home folder (the one that holds <code>public_html</code>).</li>
    <li>Open <code>flowsuit-secrets.php</code>, or create it if it is not there.</li>
    <li>Add a line <code>'erp_setup_code' =&gt; 'pick-a-long-secret-code',</code> inside the <code>return [ ... ];</code> list (at least 12 characters).</li>
    <li>Save, then refresh this page.</li>
  </ol>
<?php else: ?>
  <p class="muted">This page only works once. After this, sign in and add your team under Users and access.</p>
<?php foreach ($errors as $err): ?>
  <p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>
  <form method="post" class="form">
    <?= erp_csrf_field() ?>
    <label>Setup code<input type="password" name="code" required autocomplete="off"></label>
    <label>Your name<input name="name" value="<?= e($_POST['name'] ?? '') ?>" required maxlength="80"></label>
    <label>Email<input type="email" name="email" value="<?= e($_POST['email'] ?? '') ?>" required autocomplete="username"></label>
    <label>Password (10+ characters)<input type="password" name="password" minlength="10" required autocomplete="new-password"></label>
    <button class="btn" type="submit">Create admin account</button>
  </form>
<?php endif; ?>
</div>
