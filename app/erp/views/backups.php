<?php $title = 'Backups | FlowSuit ERP'; $active = 'backups'; ?>
<header class="page-top">
  <div><h1>Backups</h1><p class="muted">One .zip with the whole ERP (users, access, TAJ and HSEC records, files, signatures) and the website's files.<?= $last ? ' Last backup: ' . e($last) . '.' : '' ?></p></div>
  <a class="btn" href="/erp/backup"><?= icon('cloud') ?>Download backup now</a>
</header>
<section class="panel">
  <h2>Back up to your laptop and Google Drive every day at 9:00 AM</h2>
  <p class="muted">A small script on your laptop fetches the backup every morning, keeps the last 30 on the laptop and copies each one to Google Drive (last 14 kept there). If the laptop is off or asleep at 9:00, it runs as soon as the laptop is back on with internet. <?= $hasKey ? 'A script already exists; making a new one switches the old one off.' : '' ?></p>
  <form method="post" class="form backup-form">
    <?= erp_csrf_field() ?>
    <input type="hidden" name="action" value="script">
    <label>Folder on your laptop<input name="folder" value="C:\FlowSuit Backups" required></label>
    <label>Google Drive folder (leave blank to find it automatically)<input name="drive" value="" placeholder="e.g. G:\My Drive\FlowSuit Backups"></label>
    <button class="btn" type="submit">Download backup script</button>
  </form>
  <ol class="steps-list">
    <li>Install <b>Google Drive for desktop</b> (google.com/drive/download) and sign in with your Google account. A <b>Google Drive</b> drive (usually <b>G:</b>) appears in File Explorer.</li>
    <li>Click <b>Download backup script</b> above and save <b>flowsuit-backup.ps1</b> in <b>Documents</b>. Keep it private and don't move it later: it can download your ERP data, and the daily task runs it from there.</li>
    <li>Right-click the file and choose <b>Run with PowerShell</b>. If Windows asks to change the execution policy, answer <b>Y</b>.</li>
    <li>It sets up a daily 9:00 AM task called <b>FlowSuit backup</b>, makes the first backup now and says where it saved it. Press Enter to close.</li>
    <li>Check <b>C:\FlowSuit Backups</b> and <b>Google Drive › FlowSuit Backups</b> for today's .zip. Each run is noted in <b>backup-log.txt</b> in the laptop folder.</li>
  </ol>
</section>
