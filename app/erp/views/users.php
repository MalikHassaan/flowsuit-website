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
          <td><span class="lvl lvl-<?= $lvl ?: 'none' ?>"><?= $lvl ? e(erp_level_label($key, $lvl)) : 'No access' ?></span><?php if ($key === 'hsec' && $lvl): $cos = hsec_allowed($u); ?><br><span class="muted small"><?= $cos === null ? 'All companies' : e(implode(', ', $cos)) ?></span><?php endif; ?></td>
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
