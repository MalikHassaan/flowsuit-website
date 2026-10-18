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
    <label><?= $isNew ? 'Password (10+ characters)' : 'New password (leave empty to keep)' ?><input type="password" name="password" minlength="10" <?= $isNew ? 'required' : '' ?> autocomplete="new-password"></label>
  </div>
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
<?php foreach (erp_modules() as $key => $mod): $lvl = $target['access'][$key] ?? ''; ?>
    <fieldset class="access-row">
      <legend><?= icon($mod['icon']) ?><?= e($mod['name']) ?><?= $mod['ready'] ? '' : ' <span class="tag">not set up yet</span>' ?></legend>
      <label><input type="radio" name="access[<?= e($key) ?>]" value="" <?= $lvl === '' ? 'checked' : '' ?>> No access</label>
<?php foreach (ERP_LEVELS as $value => $label): ?>
      <label><input type="radio" name="access[<?= e($key) ?>]" value="<?= e($value) ?>" <?= $lvl === $value ? 'checked' : '' ?>> <?= e($label) ?></label>
<?php endforeach; ?>
    </fieldset>
<?php endforeach; ?>
  </div>
  <div class="form-actions">
    <button class="btn" type="submit"><?= $isNew ? 'Create user' : 'Save changes' ?></button>
    <a href="/erp/users">Cancel</a>
  </div>
</form>
