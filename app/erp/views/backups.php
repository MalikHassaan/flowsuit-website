<?php $title = 'Backups | FlowSuit ERP'; $active = 'backups'; ?>
<header class="page-top">
  <div><h1>Backups</h1><p class="muted">One .zip with users, access, reports, the TAJ dashboard and every saved TAJ export.<?= $last ? ' Last backup: ' . e($last) . '.' : '' ?></p></div>
  <a class="btn" href="/erp/backup"><?= icon('cloud') ?>Download backup now</a>
</header>
<section class="panel">
  <h2>Back up to your laptop automatically</h2>
  <p class="muted">Windows can fetch a backup every day with a small script. <?= $hasKey ? 'A script already exists; making a new one switches the old one off.' : '' ?></p>
  <form method="post" class="form backup-form">
    <?= erp_csrf_field() ?>
    <input type="hidden" name="action" value="script">
    <label>Folder on your laptop<input name="folder" value="C:\FlowSuit Backups" required></label>
    <button class="btn" type="submit">Download laptop backup script</button>
  </form>
  <ol class="steps-list">
    <li>Save <b>flowsuit-backup.ps1</b> in <b>Documents</b>. Keep it private: it can download your ERP data.</li>
    <li>Open <b>Task Scheduler</b> from the Start menu and click <b>Create Basic Task</b>. Name it <b>FlowSuit backup</b>.</li>
    <li>Trigger: <b>Daily</b>, at a time your laptop is usually on, for example 1:00 pm.</li>
    <li>Action: <b>Start a program</b>. Program: <code>powershell.exe</code>. Arguments: <code>-ExecutionPolicy Bypass -WindowStyle Hidden -File "PATH"</code>, where PATH is the script's location (hold Shift, right-click the file, choose <b>Copy as path</b>, and paste it without the extra quotes).</li>
    <li>Finish, then open the task's <b>Properties &gt; Settings</b> and tick <b>Run task as soon as possible after a scheduled start is missed</b>.</li>
    <li>Right-click the task and choose <b>Run</b> once. A .zip should appear in the folder. The last 30 days are kept.</li>
  </ol>
</section>
