<?php
// FlowSuit ERP: the customer app at flowsuit.net/erp.
// Users sign in, and each user only sees the modules an admin gave them access to.
// Data lives in an SQLite file outside the web root (~/flowsuit-data), never in the repository.

require_once __DIR__ . '/import.php';
require_once __DIR__ . '/taj-store.php';
require_once __DIR__ . '/hsec-store.php';
require_once __DIR__ . '/hsec-qb.php';
require_once __DIR__ . '/backup.php';
require_once __DIR__ . '/auth.php';

const ERP_SESSION_IDLE = 7200;          // seconds before an idle session signs out
const ERP_LOGIN_LIMIT = 8;              // failed logins per IP per 15 minutes
const ERP_MAX_UPLOAD = 8 * 1024 * 1024; // bytes

// Every module the ERP knows about. 'ready' modules have screens; the rest show "not set up yet".
function erp_modules(): array
{
    return [
        'receivables' => ['name' => 'TAJ Receivables', 'icon' => 'ledger', 'ready' => true, 'about' => 'TAJ Residencia receivable and recovery dashboards.'],
        'hsec'        => ['name' => 'HSEC ERP', 'icon' => 'chart', 'ready' => true, 'about' => 'HSEC restructure finance ERP: vouchers, ledgers, payables, payroll and statements.', 'edit' => 'View and edit'],
        'reports'     => ['name' => 'Reports',     'icon' => 'sheet',  'ready' => true,  'about' => 'Upload Excel or CSV reports and share them with your team.'],
        'inventory'   => ['name' => 'Inventory',   'icon' => 'boxes',  'ready' => false, 'about' => 'Stock levels, purchases and reorder alerts.'],
        'finance'     => ['name' => 'Finance',     'icon' => 'chart',  'ready' => false, 'about' => 'Expenses, payables and cash flow.'],
        'sales'       => ['name' => 'Sales',       'icon' => 'cart',   'ready' => false, 'about' => 'Invoices, orders and customers.'],
    ];
}

// Modules that are switched on; the others stay hidden until they are built.
function erp_live_modules(): array
{
    return array_filter(erp_modules(), fn(array $m): bool => $m['ready']);
}

const ERP_CLIENT_NAME = 'TAJ Residencia'; // shown on the sign-in screens

const ERP_LEVELS = ['view' => 'View only', 'edit' => 'View and upload'];

// What a level is called for one module (HSEC edits records rather than uploading files).
function erp_level_label(string $module, string $level): string
{
    return $level === 'edit' ? (erp_modules()[$module]['edit'] ?? ERP_LEVELS['edit']) : (ERP_LEVELS[$level] ?? $level);
}

function erp_data_dir(): string
{
    // On the server this is ~/flowsuit-data, next to ~/flowsuit-app and ~/public_html.
    $dir = dirname(__DIR__, 2) . '/flowsuit-data';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
        file_put_contents($dir . '/.htaccess', "Require all denied\n");
    }
    return $dir;
}

function erp_db(): PDO
{
    static $db = null;
    if ($db) {
        return $db;
    }
    $db = new PDO('sqlite:' . erp_data_dir() . '/erp.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, last_login TEXT)');
    $db->exec('CREATE TABLE IF NOT EXISTS access (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, module TEXT NOT NULL,
        level TEXT NOT NULL, PRIMARY KEY (user_id, module))');
    $db->exec('CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY, module TEXT NOT NULL, title TEXT NOT NULL, filename TEXT NOT NULL,
        columns TEXT NOT NULL, rows TEXT NOT NULL, row_count INTEGER NOT NULL,
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL, uploaded_at TEXT NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT NOT NULL, at INTEGER NOT NULL)');
    erp_auth_schema($db);
    return $db;
}

function erp_secret(string $key): ?string
{
    $file = dirname(__DIR__, 2) . '/flowsuit-secrets.php';
    if (is_file($file)) {
        $secrets = require $file;
        if (is_array($secrets) && !empty($secrets[$key])) {
            return (string) $secrets[$key];
        }
    }
    return null;
}

function erp_now(): string
{
    return date('Y-m-d H:i:s');
}

// ---- Sessions, CSRF, current user ----

// $touch is false for the dashboard's background refresh, so an open tab does not keep an idle session alive.
function erp_start_session(bool $touch = true): void
{
    $https = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    session_name('fs_erp');
    session_set_cookie_params(['path' => '/erp', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
    if (isset($_SESSION['seen']) && time() - $_SESSION['seen'] > ERP_SESSION_IDLE) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    if ($touch || !isset($_SESSION['seen'])) {
        $_SESSION['seen'] = time();
    }
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
}

function erp_csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e($_SESSION['csrf']) . '">';
}

function erp_check_csrf(): void
{
    $sent = (string) ($_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!hash_equals($_SESSION['csrf'] ?? '', $sent)) {
        http_response_code(400);
        exit('The form expired. Go back, refresh the page and try again.');
    }
}

function erp_user(): ?array
{
    static $user = false;
    if ($user === false) {
        $user = null;
        if (empty($_SESSION['uid'])) {
            erp_remember_login();
        }
        if (!empty($_SESSION['uid'])) {
            $st = erp_db()->prepare('SELECT * FROM users WHERE id = ? AND active = 1');
            $st->execute([$_SESSION['uid']]);
            $user = $st->fetch() ?: null;
            // A password change elsewhere signs out sessions that started with the old password.
            $pwv = $user ? hash('sha256', $user['password_hash']) : '';
            if ($user && isset($_SESSION['pwv']) && !hash_equals($_SESSION['pwv'], $pwv)) {
                $user = null;
                unset($_SESSION['uid'], $_SESSION['admin']);
            } elseif ($user) {
                $_SESSION['pwv'] = $pwv;
            }
            if ($user) {
                $user['access'] = erp_access_for((int) $user['id']);
            }
        }
    }
    return $user;
}

// Where someone lands after signing in: the system they picked on the "Choose your system" page
// (TAJ unless they came from the HSEC tile), or the other one when that is all they can open.
function erp_start_page(array $row): string
{
    if (!empty($row['must_change'])) {
        return '/erp/account';
    }
    $access = erp_access_for((int) $row['id']);
    $can = fn(string $key): bool => !empty($row['is_admin']) || isset($access[$key]);
    $order = ($_SESSION['system'] ?? '') === 'hsec' ? ['hsec', 'receivables'] : ['receivables', 'hsec'];
    foreach ($order as $key) {
        if ($can($key)) {
            return '/erp/m/' . $key;
        }
    }
    return '/erp';
}

// Which system's name and crest the sign-in screens show: set by the tile the person clicked.
function erp_system(): string
{
    return ($_SESSION['system'] ?? '') === 'hsec' ? 'hsec' : 'taj';
}

function erp_client_name(): string
{
    return erp_system() === 'hsec' ? 'HSEC PVT. LTD' : ERP_CLIENT_NAME;
}

function erp_access_for(int $userId): array
{
    $st = erp_db()->prepare('SELECT module, level FROM access WHERE user_id = ?');
    $st->execute([$userId]);
    $access = [];
    foreach ($st->fetchAll() as $row) {
        $access[$row['module']] = $row['level'];
    }
    return $access;
}

// Admins can do everything; others need the module listed in their access rows.
function erp_can(array $user, string $module, string $need = 'view'): bool
{
    if ($user['is_admin']) {
        return true;
    }
    $level = $user['access'][$module] ?? null;
    return $level === 'edit' || ($need === 'view' && $level === 'view');
}

function erp_redirect(string $to): void
{
    header('Location: ' . $to, true, 303);
    exit;
}

function erp_flash(?string $message = null): ?string
{
    if ($message !== null) {
        $_SESSION['flash'] = $message;
        return null;
    }
    $msg = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $msg;
}

function erp_render(string $view, array $data = [], int $status = 200): void
{
    http_response_code($status);
    $user = erp_user();
    $flash = erp_flash();
    extract($data);
    ob_start();
    require __DIR__ . '/views/' . $view . '.php';
    $content = ob_get_clean();
    require __DIR__ . '/views/layout.php';
}

// $enforceChange: someone who must change their password is sent to that page first.
function erp_require_user(bool $enforceChange = true): array
{
    $user = erp_user();
    if (!$user) {
        erp_redirect('/erp/login');
    }
    if ($enforceChange && $user['must_change']) {
        erp_redirect('/erp/account');
    }
    return $user;
}

function erp_forbidden(?array $module = null): void
{
    erp_render('locked', ['module' => $module], 403);
    exit;
}

// ---- Errors ----
// Any crash is written to ~/flowsuit-data/erp-errors.log and shown as a short page instead of
// the host's blank "500 Internal Server Error". Admins also see the error text, to send to support.

function erp_catch_errors(): void
{
    ini_set('display_errors', '0');
    $show = function (string $msg): void {
        @file_put_contents(erp_data_dir() . '/erp-errors.log', '[' . date('Y-m-d H:i:s') . '] ' . ($_SERVER['REQUEST_URI'] ?? '') . ' ' . $msg . "\n", FILE_APPEND);
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: text/html; charset=utf-8');
        }
        $detail = !empty($_SESSION['admin']) ? '<pre style="white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px">' . htmlspecialchars($msg) . '</pre>' : '';
        echo '<div style="font:16px system-ui;max-width:640px;margin:60px auto;padding:0 16px"><h1>Something went wrong</h1>'
            . '<p>The error was saved to <code>flowsuit-data/erp-errors.log</code> on the server.</p>' . $detail . '<p><a href="/erp">Back to the ERP</a></p></div>';
    };
    set_exception_handler(function (Throwable $ex) use ($show): void {
        $show(get_class($ex) . ': ' . $ex->getMessage() . ' in ' . basename($ex->getFile()) . ':' . $ex->getLine());
    });
    register_shutdown_function(function () use ($show): void {
        $err = error_get_last();
        if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            $show($err['message'] . ' in ' . basename($err['file']) . ':' . $err['line']);
        }
    });
}

// ---- Login throttling ----

function erp_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function erp_too_many_attempts(): bool
{
    $db = erp_db();
    $db->prepare('DELETE FROM login_attempts WHERE at < ?')->execute([time() - 900]);
    $st = $db->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ?');
    $st->execute([erp_ip()]);
    return (int) $st->fetchColumn() >= ERP_LOGIN_LIMIT;
}

// ---- Router ----

function erp_handle(string $path): void
{
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    date_default_timezone_set('Asia/Karachi');
    erp_catch_errors();

    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        http_response_code(500);
        exit('FlowSuit ERP needs the PHP "pdo_sqlite" extension. Turn it on in cPanel > Select PHP Version > Extensions.');
    }

    $sub = substr($path, strlen('/erp')) ?: '/';
    erp_start_session($sub !== '/m/receivables/api/sync' && $sub !== '/m/hsec/api/sync');
    $post = $_SERVER['REQUEST_METHOD'] === 'POST';
    if ($post) {
        erp_check_csrf();
    }

    $hasUsers = (int) erp_db()->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
    if (!$hasUsers && $sub !== '/setup') {
        erp_redirect('/erp/setup');
    }

    if ($sub === '/setup') {
        erp_setup($hasUsers, $post);
    } elseif ($sub === '/login') {
        erp_login($post);
    } elseif ($sub === '/logout' && $post) {
        erp_remember_clear();
        $_SESSION = [];
        session_regenerate_id(true);
        erp_redirect('/erp');
    } elseif ($sub === '/') {
        // Signed out: the list of systems; each one leads to its own sign-in screen.
        if (!erp_user()) {
            erp_render('systems');
        } else {
            erp_render('dashboard', ['me' => erp_require_user()]);
        }
    } elseif (str_starts_with($sub, '/m/receivables/api/')) {
        taj_api(substr($sub, strlen('/m/receivables/api')));
    } elseif (str_starts_with($sub, '/m/hsec/api/')) {
        hsec_api(substr($sub, strlen('/m/hsec/api')));
    } elseif ($sub === '/m/hsec' || $sub === '/m/hsec/app') {
        hsec_module($sub === '/m/hsec/app', $post);
    } elseif ($sub === '/m/receivables' || $sub === '/m/receivables/dashboard') {
        erp_dashboard_module($sub === '/m/receivables/dashboard', $post);
    } elseif (preg_match('#^/m/([a-z]+)$#', $sub, $m) && isset(erp_modules()[$m[1]])) {
        erp_module($m[1], $post);
    } elseif ($sub === '/verify') {
        erp_verify($post);
    } elseif ($sub === '/security') {
        erp_security($post);
    } elseif ($sub === '/forgot') {
        erp_forgot($post);
    } elseif ($sub === '/reset') {
        erp_reset($post);
    } elseif ($sub === '/account') {
        erp_account($post);
    } elseif ($sub === '/brand-logo') {
        erp_brand_logo();
    } elseif ($sub === '/hsec-logo') {
        hsec_logo();
    } elseif ($sub === '/backup') {
        erp_backup_download();
    } elseif ($sub === '/backups') {
        erp_backups_page($post);
    } elseif ($sub === '/analytics') {
        $days = in_array((int) ($_GET['days'] ?? 30), [7, 30, 90, 365], true) ? (int) ($_GET['days'] ?? 30) : 30;
        erp_render('analytics', ['me' => erp_require_admin(), 'days' => $days, 'r' => stats_report($days)]);
    } elseif ($sub === '/users') {
        erp_users_list();
    } elseif ($sub === '/users/new' || preg_match('#^/users/(\d+)$#', $sub, $m)) {
        erp_user_form(isset($m[1]) ? (int) $m[1] : null, $post);
    } else {
        erp_render('notfound', [], 404);
    }
}

function erp_setup(bool $hasUsers, bool $post): void
{
    if ($hasUsers) {
        erp_redirect('/erp/login');
    }
    $code = erp_secret('erp_setup_code');
    $errors = [];
    if ($post && $code !== null) {
        $name = trim((string) ($_POST['name'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        if (erp_too_many_attempts()) {
            $errors[] = 'Too many tries. Wait 15 minutes and try again.';
        } elseif (!hash_equals($code, (string) ($_POST['code'] ?? ''))) {
            erp_db()->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([erp_ip(), time()]);
            $errors[] = 'The setup code is wrong.';
        }
        $errors = array_merge($errors, erp_validate_user($name, $email, $password, true));
        if (!$errors) {
            erp_db()->prepare('INSERT INTO users (name, email, password_hash, is_admin, created_at, last_login) VALUES (?, ?, ?, 1, ?, ?)')
                ->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), erp_now(), erp_now()]);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int) erp_db()->lastInsertId();
            $_SESSION['admin'] = true;
            erp_flash('Your admin account is ready. Add your team under Users.');
            erp_redirect('/erp');
        }
    }
    erp_render('setup', ['hasCode' => $code !== null && strlen($code) >= 12, 'errors' => $errors]);
}

function erp_validate_user(string $name, string $email, string $password, bool $passwordRequired, ?int $id = null): array
{
    $errors = [];
    if ($name === '' || mb_strlen($name) > 80) {
        $errors[] = 'Enter a name (up to 80 characters).';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Enter a valid email address.';
    } else {
        $st = erp_db()->prepare('SELECT id FROM users WHERE email = ? AND id IS NOT ?');
        $st->execute([$email, $id]);
        if ($st->fetch()) {
            $errors[] = 'Another user already has this email.';
        }
    }
    if (($passwordRequired || $password !== '') && mb_strlen($password) < 10) {
        $errors[] = 'The password needs at least 10 characters.';
    }
    return $errors;
}

function erp_login(bool $post): void
{
    if (!$post) {
        $_SESSION['system'] = ($_GET['to'] ?? '') === 'hsec' ? 'hsec' : 'taj';
    }
    if ($u = erp_user()) {
        erp_redirect($u['must_change'] ? '/erp/account' : erp_start_page($u));
    }
    $error = null;
    $email = '';
    if ($post) {
        $email = trim((string) ($_POST['email'] ?? ''));
        if (erp_too_many_attempts()) {
            $error = 'Too many failed sign-ins. Wait 15 minutes and try again.';
        } else {
            $st = erp_db()->prepare('SELECT * FROM users WHERE email = ? AND active = 1');
            $st->execute([$email]);
            $row = $st->fetch();
            if ($row && password_verify((string) ($_POST['password'] ?? ''), $row['password_hash'])) {
                if (erp_otp_on()) {
                    // Password is right; the e-mailed code is the second step.
                    if (erp_otp_send('otp_login', $row, 'to sign in', ['remember' => !empty($_POST['remember'])])) {
                        erp_redirect('/erp/verify');
                    }
                    erp_render('login', ['error' => 'We could not send your sign-in code. Ask your admin.', 'email' => $email]);
                    return;
                }
                erp_sign_in($row);
                if (!empty($_POST['remember'])) {
                    erp_remember_set((int) $row['id']);
                }
                erp_redirect(erp_start_page($row));
            }
            erp_db()->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([erp_ip(), time()]);
            $error = 'That email and password do not match an active account.';
        }
    }
    erp_render('login', ['error' => $error, 'email' => $email]);
}

function erp_module(string $key, bool $post): void
{
    $me = erp_require_user();
    $module = erp_modules()[$key] + ['key' => $key];
    if (!erp_can($me, $key)) {
        erp_forbidden($module);
    }
    if (!$module['ready']) {
        erp_render('coming', ['module' => $module]);
        return;
    }

    $db = erp_db();
    $errors = [];
    if ($post && ($_POST['action'] ?? '') === 'upload') {
        if (!erp_can($me, $key, 'edit')) {
            erp_forbidden($module);
        }
        $file = $_FILES['report'] ?? null;
        $title = trim((string) ($_POST['title'] ?? ''));
        try {
            if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
                throw new RuntimeException('Choose a file to upload (Excel .xlsx or .csv).');
            }
            if ($file['size'] > ERP_MAX_UPLOAD) {
                throw new RuntimeException('The file is larger than 8 MB.');
            }
            $table = erp_read_table($file['tmp_name'], (string) $file['name']);
            $db->prepare('INSERT INTO reports (module, title, filename, columns, rows, row_count, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$key, $title !== '' ? mb_substr($title, 0, 120) : pathinfo((string) $file['name'], PATHINFO_FILENAME),
                    mb_substr(basename((string) $file['name']), 0, 160), json_encode($table['columns']), json_encode($table['rows']),
                    count($table['rows']), $me['id'], erp_now()]);
            erp_flash('Uploaded ' . count($table['rows']) . ' rows.');
            erp_redirect('/erp/m/' . $key);
        } catch (RuntimeException $ex) {
            $errors[] = $ex->getMessage();
        }
    } elseif ($post && ($_POST['action'] ?? '') === 'delete') {
        if (!erp_can($me, $key, 'edit')) {
            erp_forbidden($module);
        }
        $db->prepare('DELETE FROM reports WHERE id = ? AND module = ?')->execute([(int) ($_POST['report'] ?? 0), $key]);
        erp_flash('Report deleted.');
        erp_redirect('/erp/m/' . $key);
    }

    $list = $db->prepare('SELECT r.id, r.title, r.filename, r.row_count, r.uploaded_at, u.name AS uploader
        FROM reports r LEFT JOIN users u ON u.id = r.uploaded_by WHERE r.module = ? ORDER BY r.id DESC LIMIT 50');
    $list->execute([$key]);
    $reports = $list->fetchAll();

    $current = null;
    $wanted = isset($_GET['report']) ? (int) $_GET['report'] : ($reports[0]['id'] ?? 0);
    if ($wanted) {
        $st = $db->prepare('SELECT * FROM reports WHERE id = ? AND module = ?');
        $st->execute([$wanted, $key]);
        if ($current = $st->fetch()) {
            $current['columns'] = json_decode($current['columns'], true);
            $current['rows'] = json_decode($current['rows'], true);
            $current['summary'] = erp_receivables_summary($current['columns'], $current['rows']);
        }
    }
    erp_render('reports', ['me' => $me, 'module' => $module, 'reports' => $reports, 'current' => $current,
        'canEdit' => erp_can($me, $key, 'edit'), 'errors' => $errors]);
}

function erp_require_admin(): array
{
    $me = erp_require_user();
    if (!$me['is_admin']) {
        erp_forbidden(['name' => 'Users', 'icon' => 'users', 'key' => 'users']);
    }
    return $me;
}

function erp_users_list(): void
{
    $me = erp_require_admin();
    $users = erp_db()->query('SELECT * FROM users ORDER BY is_admin DESC, name')->fetchAll();
    foreach ($users as &$u) {
        $u['access'] = erp_access_for((int) $u['id']);
    }
    unset($u);
    $share = $_SESSION['share_link'] ?? null;
    unset($_SESSION['share_link']);
    erp_render('users', ['me' => $me, 'users' => $users, 'share' => $share]);
}

function erp_user_form(?int $id, bool $post): void
{
    $me = erp_require_admin();
    $db = erp_db();
    $target = ['id' => null, 'name' => '', 'email' => '', 'is_admin' => 0, 'active' => 1, 'access' => [], 'must_change' => 1];
    if ($id !== null) {
        $st = $db->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$id]);
        $found = $st->fetch();
        if (!$found) {
            erp_render('notfound', [], 404);
            return;
        }
        $target = $found + ['access' => erp_access_for($id)];
    }
    $isSelf = $id !== null && $id === (int) $me['id'];
    $errors = [];

    if ($post) {
        $name = trim((string) ($_POST['name'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        // New users get an e-mailed link to choose their own password, unless the admin sets one.
        $invite = $id === null && ($_POST['pw_mode'] ?? 'invite') === 'invite';
        $sendLink = $id !== null && ($_POST['action'] ?? '') === 'send_link';
        $mustChange = (int) !empty($_POST['must_change']);
        if ($invite) {
            $password = '';
        }
        // An admin cannot remove their own admin rights or switch themselves off, so nobody gets locked out.
        $isAdmin = $isSelf ? 1 : (int) !empty($_POST['is_admin']);
        $active = $isSelf ? 1 : (int) !empty($_POST['active']);
        $access = [];
        foreach (array_keys(erp_modules()) as $key) {
            $level = $_POST['access'][$key] ?? '';
            if (isset(ERP_LEVELS[$level])) {
                $access[$key] = $level;
            }
        }
        $errors = erp_validate_user($name, $email, $password, $id === null && !$invite, $id);
        if (!$errors) {
            $db->beginTransaction();
            if ($id === null) {
                $hash = password_hash($invite ? bin2hex(random_bytes(32)) : $password, PASSWORD_DEFAULT);
                $db->prepare('INSERT INTO users (name, email, password_hash, is_admin, active, created_at, must_change) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    ->execute([$name, $email, $hash, $isAdmin, $active, erp_now(), $invite ? 0 : $mustChange]);
                $id = (int) $db->lastInsertId();
                erp_user_event($id, 'Account created', $me['name']);
                if (!$invite) {
                    $db->prepare('UPDATE users SET pw_changed_at = ?, pw_how = ? WHERE id = ?')->execute([erp_now(), 'Set by admin', $id]);
                    erp_user_event($id, 'Password: set by admin', $me['name']);
                }
            } else {
                $db->prepare('UPDATE users SET name = ?, email = ?, is_admin = ?, active = ?, must_change = ? WHERE id = ?')
                    ->execute([$name, $email, $isAdmin, $active, $mustChange, $id]);
                if ($password !== '') {
                    erp_set_password($id, $password, (bool) $mustChange, 'Set by admin', $me['name']);
                }
                if (!$active) {
                    $db->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$id]);
                }
            }
            $db->prepare('DELETE FROM access WHERE user_id = ?')->execute([$id]);
            $ins = $db->prepare('INSERT INTO access (user_id, module, level) VALUES (?, ?, ?)');
            foreach ($access as $key => $level) {
                $ins->execute([$id, $key, $level]);
            }
            $db->commit();
            erp_flash('Saved ' . $name . '.');
            if ($invite || $sendLink) {
                $res = erp_send_password_link(['id' => $id, 'name' => $name, 'email' => $email], $invite ? 'invite' : 'reset');
                // Shown once on the users page, so the admin can share it if the e-mail does not arrive.
                $_SESSION['share_link'] = $res + ['name' => $name, 'email' => $email, 'invite' => $invite];
            }
            erp_redirect('/erp/users');
        }
        $target = ['id' => $id, 'name' => $name, 'email' => $email, 'is_admin' => $isAdmin, 'active' => $active, 'access' => $access, 'must_change' => $mustChange];
    }
    erp_render('user-form', ['me' => $me, 'target' => $target, 'isSelf' => $isSelf, 'errors' => $errors,
        'events' => $target['id'] ? erp_user_events((int) $target['id']) : []]);
}

// ---- TAJ receivables dashboard ----
// A self-contained HTML dashboard (built in the "BI reporting" project). It is kept in
// ~/flowsuit-data, not in the public repository, and only signed-in users with access can load it.

function erp_dashboard_file(): string
{
    return erp_data_dir() . '/modules/taj-receivables.html';
}

function erp_dashboard_module(bool $raw, bool $post): void
{
    $me = erp_require_user();
    $module = erp_modules()['receivables'] + ['key' => 'receivables'];
    if (!erp_can($me, 'receivables')) {
        erp_forbidden($module);
    }
    $file = erp_dashboard_file();

    if ($raw) {
        if (!is_file($file)) {
            erp_redirect('/erp/m/receivables');
            return;
        }
        // The ERP has already checked who this is: skip the dashboard's own sign-in and connect shared storage.
        $html = taj_wording(file_get_contents($file));
        $skip = taj_inject($me);
        $pos = stripos($html, '</head>');
        $html = $pos !== false ? substr_replace($html, $skip, $pos, 0) : $skip . $html;
        if (isset($_GET['probe'])) {
            // Quick check that PHP can read the file, without sending the whole page.
            header('Content-Type: text/plain; charset=utf-8');
            echo 'ok: ' . strlen($html) . ' bytes, gzip ' . (function_exists('gzencode') ? 'available' : 'missing');
            return;
        }
        header('X-Frame-Options: SAMEORIGIN', true);
        header('Cache-Control: private, no-store');
        header('Content-Type: text/html; charset=utf-8');
        // Send it compressed (about 4x smaller): some hosts cut off large PHP responses.
        if (function_exists('gzencode') && stripos($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip') !== false) {
            ini_set('zlib.output_compression', '0');
            $html = gzencode($html, 6);
            header('Content-Encoding: gzip');
            header('Vary: Accept-Encoding');
        }
        header('Content-Length: ' . strlen($html));
        echo $html;
        return;
    }

    $errors = [];
    if ($post && ($_POST['action'] ?? '') === 'dashboard') {
        if (!$me['is_admin']) {
            erp_forbidden($module);
        }
        $up = $_FILES['dashboard'] ?? null;
        if (!$up || $up['error'] !== UPLOAD_ERR_OK) {
            $errors[] = 'Choose the dashboard file (.html or the .zip it came in).';
        } elseif ($up['size'] > 20 * 1024 * 1024) {
            $errors[] = 'The file is larger than 20 MB.';
        } else {
            try {
                $html = erp_dashboard_html($up['tmp_name'], (string) $up['name']);
                if (!is_dir(dirname($file))) {
                    mkdir(dirname($file), 0700, true);
                }
                file_put_contents($file . '.new', $html);
                rename($file . '.new', $file);
                erp_flash('Dashboard file updated.');
                erp_redirect('/erp/m/receivables?manage=1');
            } catch (RuntimeException $ex) {
                $errors[] = $ex->getMessage();
            }
        }
    }
    if ($post && ($_POST['action'] ?? '') === 'delete_uploads') {
        if (!erp_can($me, 'receivables', 'edit')) {
            erp_forbidden($module);
        }
        $n = taj_uploads_delete($me, (array) ($_POST['uploads'] ?? []));
        erp_flash($n ? 'Deleted ' . $n . ' saved ' . ($n === 1 ? 'report' : 'reports') . '. Open dashboards update within a few seconds.' : 'Nothing was selected.');
        erp_redirect('/erp/m/receivables?manage=1#saved');
    }
    if ($post && ($_POST['action'] ?? '') === 'report_menu') {
        if (!$me['is_admin']) {
            erp_forbidden($module);
        }
        $shown = (array) ($_POST['shown'] ?? []);
        taj_hidden_set(array_diff(taj_report_ids(), $shown));
        $n = count(taj_hidden());
        erp_flash($n ? $n . ' ' . ($n === 1 ? 'report is' : 'reports are') . ' hidden from the dashboard menu.' : 'Every report is in the dashboard menu.');
        erp_redirect('/erp/m/receivables?manage=1#reports');
    }
    // The module opens full screen; admins reach this page with ?manage=1 to replace the file.
    if (!$post && is_file($file) && !isset($_GET['manage'])) {
        erp_redirect('/erp/m/receivables/dashboard');
    }
    erp_render('dashboard-host', ['me' => $me, 'module' => $module, 'hasFile' => is_file($file),
        'updated' => is_file($file) ? filemtime($file) : null, 'errors' => $errors,
        'uploads' => erp_can($me, 'receivables', 'edit') ? taj_uploads_list() : null,
        'hidden' => $me['is_admin'] ? taj_hidden() : null]);
}

// Accepts the .html itself or a .zip holding one .html file.
function erp_dashboard_html(string $path, string $name): string
{
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if ($ext === 'zip') {
        if (!class_exists('ZipArchive')) {
            throw new RuntimeException('This server cannot open .zip files. Unzip it on your computer and upload the index.html inside.');
        }
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new RuntimeException('This is not a valid .zip file.');
        }
        $html = null;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $st = $zip->statIndex($i);
            if (preg_match('/\.html?$/i', $st['name']) && $st['size'] < 30 * 1024 * 1024) {
                $html = $zip->getFromIndex($i);
                break;
            }
        }
        $zip->close();
        if ($html === null || $html === false) {
            throw new RuntimeException('No .html file found inside the .zip.');
        }
    } elseif ($ext === 'html' || $ext === 'htm') {
        $html = file_get_contents($path);
    } else {
        throw new RuntimeException('Upload the dashboard as .html or .zip.');
    }
    if (stripos($html, '<html') === false) {
        throw new RuntimeException('That file does not look like a web page.');
    }
    return $html;
}
