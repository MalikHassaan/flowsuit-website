<?php $isNew = $target['id'] === null; $title = ($isNew ? 'Add user' : 'Edit ' . $target['name']) . ' | FlowSuit ERP'; $active = 'users'; ?>
<header class="page-top">
  <div><p class="muted small"><a href="/erp/users">Users and access</a> /</p><h1><?= $isNew ? 'Add a user' : e($target['name']) ?></h1></div>
</header>
<?php foreach ($errors as $err): ?>
<p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>
<form method="post" class="panel form user-form">
  <?= erp_csrf_field() ?>
  <div class="form-grid">
    <label>Name<input name="name" value="<?= e($target['name']) ?>" required maxlength="80"></label>
    <label>Email (used to sign in)<input type="email" name="email" value="<?= e($target['email']) ?>" required></label>
<?php if (!$isNew): ?>
    <label>New password (leave empty to keep)<input type="password" name="password" minlength="10" autocomplete="new-password"></label>
<?php endif; ?>
  </div>
<?php if ($isNew): $mode = $_POST['pw_mode'] ?? 'invite'; ?>
  <fieldset class="pw-mode">
    <legend>Password</legend>
    <label class="check"><input type="radio" name="pw_mode" value="invite" data-pw-mode <?= $mode === 'invite' ? 'checked' : '' ?>> E-mail them a link to choose their own password (recommended)</label>
    <label class="check"><input type="radio" name="pw_mode" value="set" data-pw-mode <?= $mode === 'set' ? 'checked' : '' ?>> Set a password now and tell them</label>
    <div class="pw-set" data-pw-set>
      <label>Password (10+ characters)<input type="password" name="password" minlength="10" autocomplete="new-password"></label>
      <label class="check"><input type="checkbox" name="must_change" value="1" <?= $target['must_change'] ? 'checked' : '' ?>> Ask them to choose a new password at first sign-in</label>
    </div>
  </fieldset>
<?php else: ?>
  <div class="checks">
    <label class="check"><input type="checkbox" name="must_change" value="1" <?= !empty($target['must_change']) ? 'checked' : '' ?>> Ask them to choose a new password at next sign-in</label>
  </div>
<?php endif; ?>
  <div class="checks">
    <label class="check"><input type="checkbox" name="is_admin" value="1" data-admin <?= $target['is_admin'] ? 'checked' : '' ?> <?= $isSelf ? 'disabled' : '' ?>> Admin: can open everything and manage users</label>
    <label class="check"><input type="checkbox" name="active" value="1" <?= $target['active'] ? 'checked' : '' ?> <?= $isSelf ? 'disabled' : '' ?>> Account is switched on</label>
<?php if ($isSelf): ?>
    <p class="muted small">You can't remove your own admin rights or switch yourself off.</p>
<?php endif; ?>
  </div>
  <h2>Access</h2>
  <p class="muted">Pick what this person can do in each part of the ERP.</p>
  <div class="access-grid" data-access>
<?php foreach (erp_live_modules() as $key => $mod): $lvl = $target['access'][$key] ?? ''; ?>
    <fieldset class="access-row">
      <legend><?= icon($mod['icon']) ?><?= e($mod['name']) ?></legend>
      <label><input type="radio" name="access[<?= e($key) ?>]" value="" <?= $lvl === '' ? 'checked' : '' ?>> No access</label>
<?php foreach (array_keys(ERP_LEVELS) as $value): $label = erp_level_label($key, $value); ?>
      <label><input type="radio" name="access[<?= e($key) ?>]" value="<?= e($value) ?>" <?= $lvl === $value ? 'checked' : '' ?>> <?= e($label) ?></label>
<?php endforeach; ?>
    </fieldset>
<?php endforeach; ?>
  </div>
  <div class="form-actions">
    <button class="btn" type="submit"><?= $isNew ? 'Create user' : 'Save changes' ?></button>
<?php if (!$isNew && !$isSelf): ?>
    <button class="btn btn-ghost" type="submit" name="action" value="send_link">Save and e-mail a password reset link</button>
<?php endif; ?>
    <a href="/erp/users">Cancel</a>
  </div>
</form>
