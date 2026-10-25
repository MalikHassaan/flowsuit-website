<?php $title = 'Users and access | FlowSuit ERP'; $active = 'users'; ?>
<header class="page-top">
  <div><h1>Users and access</h1><p class="muted">Choose which parts of the ERP each person can open. Admins can open everything and manage users.</p></div>
  <a class="btn" href="/erp/users/new"><?= icon('users') ?>Add user</a>
</header>
<?php if (!empty($share)): ?>
<section class="panel share-link">
  <h2><?= $share['invite'] ? 'Invite for ' : 'Reset link for ' ?><?= e($share['name']) ?></h2>
  <p class="muted"><?= $share['sent'] ? 'An e-mail with this link was sent to ' . e($share['email']) . '. If it does not arrive (check spam), send them the link yourself, for example on WhatsApp.' : 'The server could not send the e-mail. Send ' . e($share['name']) . ' this link yourself, for example on WhatsApp.' ?> It works once and is shown only now.</p>
  <div class="copy-row"><input readonly value="<?= e($share['link']) ?>" data-copy-src><button class="btn" type="button" data-copy>Copy link</button></div>
</section>
<?php endif; ?>
<section class="panel">
  <div class="table-scroll">
    <table class="data access-table">
      <thead><tr><th>User</th><th>Role</th><?php foreach (erp_live_modules() as $mod): ?><th><?= e($mod['name']) ?></th><?php endforeach; ?><th>Password</th><th>Last sign-in</th><th></th></tr></thead>
      <tbody>
<?php foreach ($users as $u): ?>
        <tr class="<?= $u['active'] ? '' : 'is-off' ?>">
          <td><b><?= e($u['name']) ?></b><br><span class="muted small"><?= e($u['email']) ?></span></td>
          <td><?= $u['is_admin'] ? '<span class="tag tag-ok">Admin</span>' : ($u['active'] ? 'Member' : '<span class="tag">Switched off</span>') ?></td>
<?php foreach (array_keys(erp_live_modules()) as $key): $lvl = $u['is_admin'] ? 'edit' : ($u['access'][$key] ?? null); ?>
          <td><span class="lvl lvl-<?= $lvl ?: 'none' ?>"><?= $lvl ? e(erp_level_label($key, $lvl)) : e(erp_modules()[$key]['none'] ?? 'No access') ?></span><?php if ($key === 'hsec' && $lvl): $cos = hsec_allowed($u); ?><br><span class="muted small"><?= $cos === null ? 'All companies' : e(implode(', ', $cos)) ?></span><?php endif; ?></td>
<?php endforeach; ?>
          <td class="muted small"><?= $u['pw_changed_at'] ? e($u['pw_how']) . '<br>' . e(date('j M, g:i a', strtotime($u['pw_changed_at']))) : ($u['last_login'] ? 'Set earlier' : 'Not chosen yet') ?></td>
          <td class="muted small"><?= $u['last_login'] ? e(date('j M, g:i a', strtotime($u['last_login']))) : 'Never' ?></td>
          <td><a href="/erp/users/<?= (int) $u['id'] ?>">Edit</a></td>
        </tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
<section class="panel" id="hsec-approvals">
  <h2>HSEC voucher approval</h2>
  <p class="muted">Maker prepares and sends, Senior Manager approves first, Group GM Finance approves last. Then the voucher can be posted and printed with their signatures. Give people these roles with <b>Edit</b> on each user.</p>
  <div class="jv-flow">
<?php foreach (HSEC_JV_ROLES as $k => $label): ?>
    <div class="jv-step"><b><?= e($label) ?></b>
<?php if ($jvPeople[$k]): foreach ($jvPeople[$k] as $p): ?>
      <span><?= e($p['name']) ?><?= $p['sig'] ? '' : ' <em class="tag">no signature</em>' ?></span>
<?php endforeach; else: ?>
      <span class="muted">Nobody yet</span>
<?php endif; ?>
    </div>
<?php endforeach; ?>
  </div>
  <form method="post" class="jv-switch"><?= erp_csrf_field() ?>
<?php if ($jvOn): ?>
    <p><span class="tag tag-ok">On</span> Vouchers are approved in the system.</p>
    <button class="btn btn-ghost" type="submit" name="action" value="hsec_approvals_off">Switch off (back to paper signatures)</button>
<?php else: ?>
    <p><span class="tag">Off</span> Vouchers are printed and signed on paper.<?= !$jvPeople['senior'] || !$jvPeople['gmf'] ? ' Give someone the Senior Manager and Group GM Finance roles before switching on.' : '' ?></p>
    <button class="btn" type="submit" name="action" value="hsec_approvals_on" <?= !$jvPeople['senior'] || !$jvPeople['gmf'] ? 'disabled' : '' ?>>Switch on approval in the system</button>
<?php endif; ?>
  </form>
</section>
