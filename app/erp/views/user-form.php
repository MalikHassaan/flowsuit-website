<?php $isNew = $target['id'] === null; $title = ($isNew ? 'Add user' : 'Edit ' . $target['name']) . ' | FlowSuit ERP'; $active = 'users'; ?>
<header class="page-top">
  <div><p class="muted small"><a href="/erp/users">Users and access</a> /</p><h1><?= $isNew ? 'Add a user' : e($target['name']) ?></h1></div>
</header>
<?php foreach ($errors as $err): ?>
<p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>
<form method="post" class="panel form user-form" enctype="multipart/form-data">
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
    <label class="check"><input type="checkbox" name="active" value="1" <?= $target['active'] ? 'checked' : '' ?> <?= $isSelf ? 'disabled' : '' ?>> Account is active. Untick to make it dormant: they are signed out and cannot sign in, and their name stays on past vouchers.</label>
<?php if ($isSelf): ?>
    <p class="muted small">You can't remove your own admin rights or switch yourself off.</p>
<?php endif; ?>
  </div>
  <h2>Access</h2>
  <p class="muted">Pick what this person can do in each part of the ERP.</p>
  <label class="home-pick">Opens after sign-in
    <select name="home">
      <option value="">The first system they can open</option>
<?php foreach (ERP_SYSTEMS as $key => $label): ?>
      <option value="<?= e($key) ?>" <?= ($target['home'] ?? '') === $key ? 'selected' : '' ?>><?= e($label) ?></option>
<?php endforeach; ?>
    </select>
    <small class="muted">Everyone signs in on the same page. This decides which ERP they land on. They still need access to it below.</small>
  </label>
  <div class="access-grid" data-access>
<?php foreach (erp_live_modules() as $key => $mod): $lvl = $target['access'][$key] ?? ''; ?>
    <fieldset class="access-row">
      <legend><?= icon($mod['icon']) ?><?= e($mod['name']) ?></legend>
      <label><input type="radio" name="access[<?= e($key) ?>]" value="" <?= $lvl === '' ? 'checked' : '' ?>> <?= e($mod['none'] ?? 'No access') ?></label>
<?php foreach (array_keys(ERP_LEVELS) as $value): $label = erp_level_label($key, $value); ?>
      <label><input type="radio" name="access[<?= e($key) ?>]" value="<?= e($value) ?>" <?= $lvl === $value ? 'checked' : '' ?>> <?= e($label) ?></label>
<?php endforeach; ?>
    </fieldset>
<?php endforeach; ?>
  </div>
<?php $companies = hsec_companies(); $picked = array_filter(explode(',', (string) ($target['hsec_ents'] ?? ''))); $scope = $_POST['hsec_scope'] ?? ($picked ? 'some' : 'all'); ?>
  <fieldset class="hsec-cos" data-hsec-cos>
    <legend>HSEC ERP: which companies</legend>
    <p class="muted small">Only counts when this person has HSEC access. They see the records of these companies only; the server never sends them the others. Admins always see every company.</p>
    <label class="check"><input type="radio" name="hsec_scope" value="all" <?= $scope === 'all' ? 'checked' : '' ?>> <b>All companies</b> (with the consolidated group view)</label>
    <label class="check"><input type="radio" name="hsec_scope" value="some" <?= $scope === 'some' ? 'checked' : '' ?>> Only these companies:</label>
    <div class="co-picks">
<?php foreach ($companies as $code => $coName): ?>
      <label class="check"><input type="checkbox" name="hsec_ents[]" value="<?= e($code) ?>" <?= in_array($code, $_POST['hsec_ents'] ?? $picked, true) ? 'checked' : '' ?>> <?= e($coName) ?></label>
<?php endforeach; ?>
    </div>
    <p class="muted small">With two or more companies ticked, their "All my companies" view adds those companies together.</p>
  </fieldset>
<?php $nav = hsec_nav(); $pickedMods = array_filter(explode(',', (string) ($target['hsec_mods'] ?? ''))); $modScope = $_POST['hsec_mod_scope'] ?? ($pickedMods ? 'some' : 'all'); $tickedMods = $_POST['hsec_mods'] ?? $pickedMods; ?>
  <fieldset class="hsec-cos hsec-mods" data-hsec-cos>
    <legend>HSEC ERP: menu areas (left panel)</legend>
    <p class="muted small">They see and work in the ticked areas only; everything else disappears from their left panel. Home is always there. Admins always see everything.</p>
    <label class="check"><input type="radio" name="hsec_mod_scope" value="all" <?= $modScope === 'all' ? 'checked' : '' ?>> <b>All menu areas</b></label>
    <label class="check"><input type="radio" name="hsec_mod_scope" value="some" <?= $modScope === 'some' ? 'checked' : '' ?>> Only these areas:</label>
<?php if (!$nav): ?>
    <p class="muted small">Upload the HSEC file first; the list comes from its menu.</p>
<?php endif; ?>
    <div class="mod-groups">
<?php foreach ($nav as [$group, $items]): if (count($items) === 1 && $items[0][0] === 'dashboard') continue; ?>
      <div class="mod-group">
        <b><?= e($group) ?></b>
<?php foreach ($items as [$key, $label]): ?>
        <label class="check"><input type="checkbox" name="hsec_mods[]" value="<?= e($key) ?>" <?= in_array($key, $tickedMods, true) ? 'checked' : '' ?>> <?= e($label) ?></label>
<?php endforeach; ?>
      </div>
<?php endforeach; ?>
    </div>
  </fieldset>
<?php $jvRole = $_POST['hsec_jv'] ?? ($target['hsec_jv'] ?? ''); $hasSig = $target['id'] && is_file(hsec_sig_file((int) $target['id'])); ?>
  <fieldset class="hsec-cos hsec-jv" data-hsec-cos>
    <legend>HSEC ERP: voucher approval</legend>
    <p class="muted small">Vouchers go Maker, then Senior Manager, then Group GM Finance. Nobody can approve a voucher they prepared, and the server checks every step.</p>
    <div class="jv-roles">
      <label class="check"><input type="radio" name="hsec_jv" value="" <?= $jvRole === '' ? 'checked' : '' ?>> No approval role</label>
<?php foreach (HSEC_JV_ROLES as $k => $label): ?>
      <label class="check"><input type="radio" name="hsec_jv" value="<?= e($k) ?>" <?= $jvRole === $k ? 'checked' : '' ?>> <b><?= e($label) ?></b> <span class="muted small"><?= ['maker' => 'prepares vouchers and sends them for approval', 'senior' => 'first approval', 'gmf' => 'final approval'][$k] ?></span></label>
<?php endforeach; ?>
    </div>
    <div class="sig-row">
<?php if ($hasSig): ?>
      <figure class="sig-now"><img src="/erp/m/hsec/sig/<?= (int) $target['id'] ?>?v=<?= filemtime(hsec_sig_file((int) $target['id'])) ?>" alt="Current signature"><figcaption class="muted small">Current signature</figcaption></figure>
<?php endif; ?>
      <label>Digital signature (PNG or JPG, under 1 MB)<input type="file" name="hsec_sig" accept="image/png,image/jpeg"></label>
<?php if ($hasSig): ?>
      <label class="check"><input type="checkbox" name="hsec_sig_remove" value="1"> Remove the signature</label>
<?php endif; ?>
    </div>
    <p class="muted small">Sign on white paper in dark ink, take a clear photo, crop it close and upload it. It is printed on the vouchers this person prepares or approves.</p>
  </fieldset>
  <div class="form-actions">
    <button class="btn" type="submit"><?= $isNew ? 'Create user' : 'Save changes' ?></button>
<?php if (!$isNew && !$isSelf): ?>
    <button class="btn btn-ghost" type="submit" name="action" value="send_link">Save and e-mail a password reset link</button>
<?php endif; ?>
    <a href="/erp/users">Cancel</a>
  </div>
</form>
<?php if (!$isNew): ?>
<section class="panel">
  <h2>Account history</h2>
  <p class="muted small">Invites, reset codes and password changes for <?= e($target['name']) ?>, newest first. Passwords themselves are never stored, only a scrambled check.</p>
<?php if ($events): ?>
  <table class="data">
    <thead><tr><th>When</th><th>What happened</th><th>By</th></tr></thead>
    <tbody>
<?php foreach ($events as $ev): ?>
      <tr><td class="small"><?= e(date('j M Y, g:i a', strtotime($ev['at']))) ?></td><td><?= e($ev['what']) ?></td><td class="muted small"><?= e($ev['by_name'] ?? $target['name']) ?></td></tr>
<?php endforeach; ?>
    </tbody>
  </table>
<?php else: ?>
  <p class="muted">Nothing yet. From now on every invite, reset code and password change is listed here.</p>
<?php endif; ?>
</section>
<?php endif; ?>
