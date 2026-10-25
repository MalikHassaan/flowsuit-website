<?php
// Backups of the ERP: one .zip with the database, the TAJ dashboard file and every saved export.
// Admins download it from /erp/backups. A laptop can fetch it on a schedule with a backup key:
// the admin downloads a small Windows script that holds the key, and Task Scheduler runs it.
// Only a hash of the key is kept on the server; making a new script switches off the old one.

function erp_backup_key_hash(): ?string
{
    $db = erp_db();
    $db->exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
    $st = $db->prepare("SELECT value FROM settings WHERE name = 'backup_key'");
    $st->execute();
    return $st->fetchColumn() ?: null;
}

function erp_backup_last(): ?string
{
    $st = erp_db()->prepare("SELECT value FROM settings WHERE name = 'backup_last'");
    $st->execute();
    return $st->fetchColumn() ?: null;
}

function erp_backup_set(string $name, string $value): void
{
    erp_backup_key_hash(); // makes sure the table exists
    erp_db()->prepare('INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value')
        ->execute([$name, $value]);
}

// GET /erp/backup: the .zip, for a signed-in admin or a request carrying the backup key.
function erp_backup_download(): void
{
    $sent = (string) ($_SERVER['HTTP_X_BACKUP_KEY'] ?? '');
    if ($sent !== '') {
        $hash = erp_backup_key_hash();
        if (erp_too_many_attempts() || !$hash || !hash_equals($hash, hash('sha256', $sent))) {
            erp_db()->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([erp_ip(), time()]);
            http_response_code(403);
            header('Content-Type: text/plain; charset=utf-8');
            exit('Backup key not accepted. Download a new backup script from FlowSuit ERP > Backups.');
        }
        erp_backup_set('backup_last', erp_now() . ' (laptop script)');
    } else {
        erp_require_admin();
        erp_backup_set('backup_last', erp_now() . ' (downloaded by ' . erp_user()['name'] . ')');
    }
    erp_backup_send();
}

function erp_backup_send(): void
{
    if (!class_exists('ZipArchive')) {
        http_response_code(500);
        exit('This server cannot make .zip files (PHP zip extension is off).');
    }
    $dir = erp_data_dir();
    $tmp = $dir . '/backup-' . bin2hex(random_bytes(6));
    // A consistent copy of the database, even while people are using it.
    try {
        erp_db()->exec('VACUUM INTO ' . erp_db()->quote($tmp . '.sqlite'));
    } catch (PDOException $ex) {
        copy($dir . '/erp.sqlite', $tmp . '.sqlite');
    }
    $zip = new ZipArchive();
    $zip->open($tmp . '.zip', ZipArchive::CREATE);
    $zip->addFile($tmp . '.sqlite', 'erp.sqlite');
    foreach (['modules', 'taj-assets', 'chat-files', 'att-photos', 'signatures'] as $sub) {
        foreach (glob($dir . '/' . $sub . '/*') ?: [] as $file) {
            if (is_file($file)) {
                $zip->addFile($file, $sub . '/' . basename($file));
            }
        }
    }
    $zip->addFromString('README.txt', "FlowSuit ERP backup made " . erp_now() . " (Asia/Karachi).\r\n"
        . "erp.sqlite = users, access, reports and TAJ records. modules = TAJ dashboard file. taj-assets = saved TAJ exports. chat-files = files sent in the staff chat. att-photos = check-in selfies. signatures = HSEC voucher signatures.\r\n"
        . "To restore, send this file to whoever looks after the website.\r\n");
    $zip->close();
    @unlink($tmp . '.sqlite');

    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="flowsuit-erp-backup-' . date('Y-m-d') . '.zip"');
    header('Cache-Control: private, no-store');
    header('Content-Length: ' . filesize($tmp . '.zip'));
    readfile($tmp . '.zip');
    @unlink($tmp . '.zip');
    exit;
}

// /erp/backups: the admin page, and the laptop script.
function erp_backups_page(bool $post): void
{
    $me = erp_require_admin();
    if ($post && ($_POST['action'] ?? '') === 'script') {
        $key = bin2hex(random_bytes(24));
        erp_backup_set('backup_key', hash('sha256', $key));
        $folder = trim((string) ($_POST['folder'] ?? '')) ?: 'C:\\FlowSuit Backups';
        $folder = str_replace(["'", "\r", "\n"], '', $folder);
        $script = erp_backup_script($key, $folder);
        header('Content-Type: text/plain; charset=utf-8');
        header('Content-Disposition: attachment; filename="flowsuit-backup.ps1"');
        header('Cache-Control: private, no-store');
        echo $script;
        exit;
    }
    erp_render('backups', ['me' => $me, 'hasKey' => erp_backup_key_hash() !== null, 'last' => erp_backup_last()]);
}

function erp_backup_script(string $key, string $folder): string
{
    $host = $_SERVER['HTTP_HOST'] ?? 'flowsuit.net';
    $lines = [
        '# FlowSuit ERP backup. Saves a copy of the ERP into the folder below and keeps the last 30.',
        '# Keep this file private: anyone with it can download your ERP data.',
        '# Made ' . erp_now() . '. Downloading a new script from FlowSuit ERP > Backups switches this one off.',
        '$folder = \'' . $folder . '\'',
        '$key = \'' . $key . '\'',
        '[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12',
        'New-Item -ItemType Directory -Force -Path $folder | Out-Null',
        '$file = Join-Path $folder (\'flowsuit-erp-backup-\' + (Get-Date -Format \'yyyy-MM-dd\') + \'.zip\')',
        'Invoke-WebRequest -Uri \'https://' . $host . '/erp/backup\' -Headers @{ \'X-Backup-Key\' = $key } -OutFile $file -UseBasicParsing',
        'Get-ChildItem -Path $folder -Filter \'flowsuit-erp-backup-*.zip\' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item',
    ];
    return implode("\r\n", $lines) . "\r\n";
}
