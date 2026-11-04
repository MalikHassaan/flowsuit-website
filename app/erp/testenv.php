<?php
// Test site (hassan, 2026-11-04: "a test environment where I can post anything but it doesn't change the live
// environment"). test.flowsuit.net runs the same code as flowsuit.net, but its web folder has a .flowsuit-test marker
// (added by the deploy), so erp_data_dir() is ~/flowsuit-test-data. That folder starts as a copy of the live data;
// an admin can wipe it and copy live again from the orange bar. Nothing here ever writes to ~/flowsuit-data.

const ERP_TEST_COPY = ['modules', 'taj-assets', 'chat-files', 'att-photos', 'signatures', 'hsec-att'];
const ERP_TEST_FILES = ['brand-logo.png', 'hsec-logo.png', 'hsec-nav.json', 'hsec-nav-v2.json'];

function erp_live_dir(): string
{
    return dirname(__DIR__, 2) . '/flowsuit-data';
}

// Copies the live ERP into $dir: a consistent snapshot of the database (opened read-only) and the files folders.
function erp_test_seed(string $dir): void
{
    $lock = fopen($dir . '/.seeding', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('The test copy could not be prepared.');
    }
    try {
        if (is_file($dir . '/erp.sqlite')) {
            return;   // another request finished it while this one waited
        }
        $live = erp_live_dir();
        $tmp = $dir . '/seed-' . bin2hex(random_bytes(4)) . '.sqlite';
        if (is_file($live . '/erp.sqlite')) {
            $src = new PDO('sqlite:' . $live . '/erp.sqlite', null, null,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY]);
            $src->exec('PRAGMA busy_timeout = 5000');
            $src->exec('VACUUM INTO ' . $src->quote($tmp));
            $src = null;
        } else {
            touch($tmp);   // no live data yet: start empty
        }
        foreach (ERP_TEST_COPY as $sub) {
            if (!is_dir($live . '/' . $sub)) {
                continue;
            }
            @mkdir($dir . '/' . $sub, 0700, true);
            foreach (glob($live . '/' . $sub . '/*') ?: [] as $f) {
                if (is_file($f)) {
                    copy($f, $dir . '/' . $sub . '/' . basename($f));
                }
            }
        }
        foreach (ERP_TEST_FILES as $f) {
            if (is_file($live . '/' . $f)) {
                copy($live . '/' . $f, $dir . '/' . $f);
            }
        }
        file_put_contents($dir . '/test-copied.txt', date('Y-m-d H:i'));
        rename($tmp, $dir . '/erp.sqlite');
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

// POST /erp/test-reset (test site, admins): throw away everything done on the test site and copy live again.
function erp_test_reset(bool $post): void
{
    if (!fs_is_test()) {
        erp_render('notfound', [], 404);
        return;
    }
    $me = erp_require_admin();
    if (!$post || !hash_equals((string) ($_SESSION['csrf'] ?? ''), (string) ($_POST['csrf'] ?? ''))) {
        header('Location: /erp');
        exit;
    }
    $dir = erp_data_dir();
    if (basename($dir) !== 'flowsuit-test-data') {
        exit('Not the test data folder.');   // never wipe anything else
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) {
        if ($f->getFilename() === '.htaccess' && $f->getPath() === $dir) {
            continue;
        }
        $f->isDir() && !$f->isLink() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
    }
    erp_test_seed($dir);
    $_SESSION = [];
    header('Location: /erp/login');
    exit;
}

function erp_test_when(): string
{
    $f = erp_data_dir() . '/test-copied.txt';
    return is_file($f) ? trim((string) file_get_contents($f)) : '';
}

// The orange bar on every ERP page of the test site.
function erp_test_banner(?array $user): string
{
    if (!fs_is_test()) {
        return '';
    }
    $reset = '';
    if ($user && !empty($user['is_admin'])) {
        $reset = '<form method="post" action="/erp/test-reset" onsubmit="return confirm(\'Delete everything done on the test site and copy the live ERP again?\')">'
            . erp_csrf_field() . '<button type="submit">Start again from live</button></form>';
    }
    $when = erp_test_when();
    return '<div class="fs-testbar" style="position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;max-width:calc(100% - 24px);border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,.25);'
        . 'background:#e8590c;color:#fff;font:600 13px/1.3 Inter,Arial,sans-serif;padding:7px 14px;text-align:center">'
        . '<span>TEST SITE: nothing you do here changes the live ERP' . ($when !== '' ? ' (copy of live from ' . e($when) . ')' : '') . '.</span>'
        . str_replace('<button', '<button style="background:#fff;color:#e8590c;border:0;border-radius:4px;padding:3px 10px;font:inherit;cursor:pointer"', $reset)
        . '</div>';
}

// Adds the bar to the big app pages (TAJ, HSEC).
function erp_test_mark(string $html): string
{
    if (!fs_is_test()) {
        return $html;
    }
    $bar = erp_test_banner(erp_user());
    // at the very end: the browser puts it in the body (a "</body>" in the file can sit inside the app's own scripts)
    return $html . $bar;
}
