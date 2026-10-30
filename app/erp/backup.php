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

// The password every backup .zip is locked with (AES-256), chosen by an admin on the Backups page (hassan,
// 2026-10-27). Kept in the ERP database outside the web folder; it is needed here to lock each new backup.
function erp_backup_zip_pw(): ?string
{
    erp_backup_key_hash();
    $st = erp_db()->prepare("SELECT value FROM settings WHERE name = 'backup_zip_pw'");
    $st->execute();
    return $st->fetchColumn() ?: null;
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
    foreach (['modules', 'taj-assets', 'chat-files', 'att-photos', 'signatures', 'hsec-att'] as $sub) {
        foreach (glob($dir . '/' . $sub . '/*') ?: [] as $file) {
            if (is_file($file)) {
                $zip->addFile($file, $sub . '/' . basename($file));
            }
        }
    }
    // Website visitor numbers.
    if (is_file($dir . '/stats.sqlite')) {
        $zip->addFile($dir . '/stats.sqlite', 'stats.sqlite');
    }
    // The website itself, as it runs on the server (hassan, 2026-10-27): the web root and the app folder beside it.
    // Secrets live outside both (~/flowsuit-secrets.php) and are never included.
    $site = ['website/public_html' => defined('WEB_ROOT') ? WEB_ROOT : null, 'website/app' => realpath(__DIR__ . '/..')];
    foreach ($site as $as => $root) {
        if (!$root || !is_dir($root)) {
            continue;
        }
        $it = new RecursiveIteratorIterator(new RecursiveCallbackFilterIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
            fn($f) => !in_array($f->getFilename(), ['.git', 'cgi-bin', 'node_modules', '.well-known', 'error_log'], true)
                && ($f->isDir() || $f->getSize() < 25 * 1024 * 1024)));
        foreach ($it as $f) {
            if ($f->isFile()) {
                $zip->addFile($f->getPathname(), $as . '/' . str_replace('\\', '/', substr($f->getPathname(), strlen($root) + 1)));
            }
        }
    }
    $pw = erp_backup_zip_pw();
    $locked = false;
    if ($pw && defined('ZipArchive::EM_AES_256')) {
        $locked = true;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $locked = $zip->setEncryptionIndex($i, ZipArchive::EM_AES_256, $pw) && $locked;
        }
    }
    if ($pw && !$locked) {
        erp_backup_set('backup_unlocked', erp_now());
    }
    $zip->addFromString('README.txt', "FlowSuit ERP backup made " . erp_now() . " (Asia/Karachi).\r\n"
        . "erp.sqlite = users, access, reports and TAJ records. modules = TAJ dashboard file. taj-assets = saved TAJ exports. chat-files = files sent in the staff chat. att-photos = check-in selfies. signatures = HSEC voucher signatures. hsec-att = supporting documents attached to HSEC vouchers and records. stats.sqlite = website visitor numbers. website = the website's files as they run on the server.\r\n"
        . ($locked ? "The files are locked with your backup password (AES-256). Open this .zip with 7-Zip (7-zip.org); Windows' own zip viewer cannot open AES-locked files.\r\n" : "")
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
        $drive = str_replace(["'", "\r", "\n"], '', trim((string) ($_POST['drive'] ?? '')));
        $script = erp_backup_script($key, $folder, $drive);
        header('Content-Type: text/plain; charset=utf-8');
        header('Content-Disposition: attachment; filename="flowsuit-backup.ps1"');
        header('Cache-Control: private, no-store');
        echo $script;
        exit;
    }
    $msg = null;
    if ($post && ($_POST['action'] ?? '') === 'zip_pw') {
        $a = (string) ($_POST['pw'] ?? '');
        $b = (string) ($_POST['pw2'] ?? '');
        if (mb_strlen($a) < 10) {
            $msg = ['err', 'Use at least 10 characters.'];
        } elseif ($a !== $b) {
            $msg = ['err', 'The two passwords do not match.'];
        } else {
            $had = erp_backup_zip_pw() !== null;
            erp_backup_set('backup_zip_pw', $a);
            erp_user_event((int) $me['id'], 'Backup password ' . ($had ? 'changed' : 'set'), $me['name']);
            $msg = ['ok', 'Saved. Every backup from now on is locked with this password. Write it down somewhere safe: without it the backups cannot be opened.'];
        }
    }
    erp_render('backups', ['me' => $me, 'hasKey' => erp_backup_key_hash() !== null, 'last' => erp_backup_last(),
        'hasPw' => erp_backup_zip_pw() !== null, 'canLock' => defined('ZipArchive::EM_AES_256'), 'msg' => $msg]);
}

function erp_backup_script(string $key, string $folder, string $drive = ''): string
{
    $host = $_SERVER['HTTP_HOST'] ?? 'flowsuit.net';
    // Run once by hand: it sets up the Windows task (daily 9:00 AM; if the laptop was off or asleep, as soon as
    // it is back on with internet) and makes the first backup. The task then runs it with -Run.
    $ps = <<<'PS'
# FlowSuit backup: the whole ERP and the website, to this laptop and to Google Drive, every day at 9:00 AM.
# Keep this file private: anyone with it can download your ERP data.
# Made {MADE}. Downloading a new script from FlowSuit ERP > Backups switches this one off.
# First time: right-click this file and choose "Run with PowerShell". That sets up the daily backup and makes one now.
param([switch]$Run)
$folder = '{FOLDER}'
$drive = '{DRIVE}'   # Google Drive folder; blank = found automatically (Google Drive for desktop must be installed)
$key = '{KEY}'
$keepHere = 30
$keepDrive = 14
$log = Join-Path $folder 'backup-log.txt'
New-Item -ItemType Directory -Force -Path $folder | Out-Null
function Note($t) { Add-Content -Path $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm') + '  ' + $t) }

if (-not $Run) {
    $me = $MyInvocation.MyCommand.Path
    $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $me + '" -Run')
    $trg = New-ScheduledTaskTrigger -Daily -At '9:00 AM'
    $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -RestartCount 6 -RestartInterval (New-TimeSpan -Minutes 10) -ExecutionTimeLimit (New-TimeSpan -Hours 2)
    Register-ScheduledTask -TaskName 'FlowSuit backup' -Description 'FlowSuit ERP and website backup, daily 9:00 AM' -Action $act -Trigger $trg -Settings $set -Force | Out-Null
    Write-Host 'Daily backup at 9:00 AM is set up (task "FlowSuit backup"). Making the first backup now...'
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$file = Join-Path $folder ('flowsuit-erp-backup-' + (Get-Date -Format 'yyyy-MM-dd') + '.zip')
$part = $file + '.part'
# Three tries, ten minutes apart, in case the internet is not up yet after the laptop wakes.
$err = ''
for ($try = 1; $try -le 3; $try++) {
    try {
        Invoke-WebRequest -Uri 'https://{HOST}/erp/backup' -Headers @{ 'X-Backup-Key' = $key } -OutFile $part -UseBasicParsing -TimeoutSec 1800
        Move-Item -Force $part $file
        $err = ''
        break
    } catch {
        Remove-Item $part -ErrorAction SilentlyContinue
        $err = $_.Exception.Message
        if ($try -lt 3 -and $Run) { Start-Sleep -Seconds 600 } elseif (-not $Run) { break }
    }
}
if ($err) {
    Note ('FAILED: ' + $err)
    if (-not $Run) { Write-Host ('Backup failed: ' + $err); Read-Host 'Press Enter to close' }
    exit 1
}
$mb = [math]::Round((Get-Item $file).Length / 1MB, 1)
Get-ChildItem -Path $folder -Filter 'flowsuit-erp-backup-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $keepHere | Remove-Item

if (-not $drive) {
    $places = @()
    Get-PSDrive -PSProvider FileSystem | ForEach-Object { $places += (Join-Path $_.Root 'My Drive') }
    $places += (Join-Path $env:USERPROFILE 'Google Drive\My Drive'), (Join-Path $env:USERPROFILE 'My Drive'), (Join-Path $env:USERPROFILE 'Google Drive')
    $g = $places | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($g) { $drive = Join-Path $g 'FlowSuit Backups' }
}
if ($drive) {
    New-Item -ItemType Directory -Force -Path $drive | Out-Null
    Copy-Item -Force $file $drive
    Get-ChildItem -Path $drive -Filter 'flowsuit-erp-backup-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $keepDrive | Remove-Item
    Note ('OK ' + $mb + ' MB, saved here and in Google Drive (' + $drive + ')')
} else {
    Note ('OK ' + $mb + ' MB, saved here. Google Drive folder NOT found: install Google Drive for desktop and sign in.')
}
if (-not $Run) { Write-Host ('Done: ' + $file + ' (' + $mb + ' MB). ' + ($(if ($drive) { 'Copied to ' + $drive } else { 'Google Drive not found, so no Drive copy.' }))); Read-Host 'Press Enter to close' }
PS;
    $ps = strtr($ps, ['{MADE}' => erp_now(), '{FOLDER}' => $folder, '{DRIVE}' => $drive, '{KEY}' => $key, '{HOST}' => $host]);
    return str_replace("\n", "\r\n", $ps) . "\r\n";
}
