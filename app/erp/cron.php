<?php
// cPanel cron job (every 15 minutes): php ~/flowsuit-app/erp/cron.php
// Sends the end-of-day check-out e-mails even when nobody has the ERP open.
if (PHP_SAPI !== 'cli') {
    exit;
}
$_SERVER['HTTPS'] = 'on';
$_SERVER['HTTP_HOST'] = 'flowsuit.net';
require dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/erp.php';
date_default_timezone_set('Asia/Karachi');
erp_setting_set('att_last_run', (string) time());
echo 'Reminders sent: ' . att_reminders() . "\n";
