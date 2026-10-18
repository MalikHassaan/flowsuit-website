<?php $title = 'Users and access | FlowSuit ERP'; $active = 'users'; ?>
<header class="page-top">
  <div><h1>Users and access</h1><p class="muted">Choose which parts of the ERP each person can open. Admins can open everything and manage users.</p></div>
  <a class="btn" href="/erp/users/new"><?= icon('users') ?>Add user</a>
</header>
<section class="panel">
  <div class="table-scroll">
    <table class="data access-table">
      <thead><tr><th>User</th><th>Role</th><?php foreach (erp_modules() as $mod): ?><th><?= e($mod['name']) ?></th><?php endforeach; ?><th>Last sign-in</th><th></th></tr></thead>
      <tbody>
<?php foreach ($users as $u): ?>
        <tr class="<?= $u['active'] ? '' : 'is-off' ?>">
          <td><b><?= e($u['name']) ?></b><br><span class="muted small"><?= e($u['email']) ?></span></td>
          <td><?= $u['is_admin'] ? '<span class="tag tag-ok">Admin</span>' : ($u['active'] ? 'Member' : '<span class="tag">Switched off</span>') ?></td>
<?php foreach (array_keys(erp_modules()) as $key): $lvl = $u['is_admin'] ? 'edit' : ($u['access'][$key] ?? null); ?>
          <td><span class="lvl lvl-<?= $lvl ?: 'none' ?>"><?= $lvl === 'edit' ? 'View + upload' : ($lvl === 'view' ? 'View' : 'No access') ?></span></td>
<?php endforeach; ?>
          <td class="muted small"><?= $u['last_login'] ? e(date('j M, g:i a', strtotime($u['last_login']))) : 'Never' ?></td>
          <td><a href="/erp/users/<?= (int) $u['id'] ?>">Edit</a></td>
        </tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>
