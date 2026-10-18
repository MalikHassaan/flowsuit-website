<?php
// Sign-in extras: "remember me", forgot / reset password, invite links, change password,
// and the client logo on the sign-in screen.
// Tokens are stored as SHA-256 hashes; the link or cookie holds selector.validator.

const ERP_REMEMBER_DAYS = 30;
const ERP_RESET_MINUTES = 60;          // forgot-password links
const ERP_INVITE_HOURS = 72;           // links an admin sends when creating a user
const ERP_REMEMBER_COOKIE = 'fs_erp_remember';

function erp_auth_schema(PDO $db): void
{
    $db->exec('CREATE TABLE IF NOT EXISTS auth_tokens (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, selector TEXT NOT NULL UNIQUE, hash TEXT NOT NULL, expires INTEGER NOT NULL)');
    $cols = array_column($db->query('PRAGMA table_info(users)')->fetchAll(), 'name');
    if (!in_array('must_change', $cols, true)) {
        $db->exec('ALTER TABLE users ADD COLUMN must_change INTEGER NOT NULL DEFAULT 0');
    }
}

// Returns "selector.validator" for a link or cookie.
function erp_token_create(int $userId, string $kind, int $seconds): string
{
    $db = erp_db();
    $db->prepare('DELETE FROM auth_tokens WHERE expires < ?')->execute([time()]);
    if ($kind !== 'remember') {
        // Only the newest reset or invite link works.
        $db->prepare("DELETE FROM auth_tokens WHERE user_id = ? AND kind IN ('reset', 'invite')")->execute([$userId]);
    }
    $selector = bin2hex(random_bytes(9));
    $validator = bin2hex(random_bytes(24));
    $db->prepare('INSERT INTO auth_tokens (user_id, kind, selector, hash, expires) VALUES (?, ?, ?, ?, ?)')
        ->execute([$userId, $kind, $selector, hash('sha256', $validator), time() + $seconds]);
    return $selector . '.' . $validator;
}

// The active user a token belongs to, or null. $kinds limits which tokens count.
function erp_token_user(string $token, array $kinds): ?array
{
    if (!preg_match('/^([a-f0-9]{18})\.([a-f0-9]{48})$/', $token, $m)) {
        return null;
    }
    $st = erp_db()->prepare('SELECT t.kind, t.hash, t.expires, u.* FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.selector = ?');
    $st->execute([$m[1]]);
    $row = $st->fetch();
    if (!$row || !in_array($row['kind'], $kinds, true) || $row['expires'] < time() || !$row['active']
        || !hash_equals($row['hash'], hash('sha256', $m[2]))) {
        return null;
    }
    $row['token_kind'] = $row['kind'];
    return $row;
}

function erp_token_drop(string $token): void
{
    erp_db()->prepare('DELETE FROM auth_tokens WHERE selector = ?')->execute([substr($token, 0, 18)]);
}

function erp_https(): bool
{
    return ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function erp_base_url(): string
{
    return (erp_https() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'flowsuit.net');
}

function erp_remember_set(int $userId): void
{
    $token = erp_token_create($userId, 'remember', ERP_REMEMBER_DAYS * 86400);
    setcookie(ERP_REMEMBER_COOKIE, $token, ['expires' => time() + ERP_REMEMBER_DAYS * 86400, 'path' => '/erp',
        'secure' => erp_https(), 'httponly' => true, 'samesite' => 'Lax']);
}

function erp_remember_clear(): void
{
    if (!empty($_COOKIE[ERP_REMEMBER_COOKIE])) {
        erp_token_drop((string) $_COOKIE[ERP_REMEMBER_COOKIE]);
    }
    setcookie(ERP_REMEMBER_COOKIE, '', ['expires' => time() - 3600, 'path' => '/erp', 'secure' => erp_https(), 'httponly' => true, 'samesite' => 'Lax']);
}

// Called when there is no signed-in session: a valid "remember me" cookie signs the person in again.
function erp_remember_login(): void
{
    $token = (string) ($_COOKIE[ERP_REMEMBER_COOKIE] ?? '');
    if ($token === '') {
        return;
    }
    $row = erp_token_user($token, ['remember']);
    erp_token_drop($token);
    if (!$row) {
        erp_remember_clear();
        return;
    }
    erp_sign_in($row);
    erp_remember_set((int) $row['id']); // a fresh cookie each time, so a stolen old one stops working
}

function erp_sign_in(array $row): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $row['id'];
    $_SESSION['admin'] = (bool) $row['is_admin'];
    $_SESSION['pwv'] = hash('sha256', $row['password_hash']);
    erp_db()->prepare('UPDATE users SET last_login = ? WHERE id = ?')->execute([erp_now(), $row['id']]);
}

function erp_set_password(int $userId, string $password, bool $mustChange = false): void
{
    $db = erp_db();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $db->prepare('UPDATE users SET password_hash = ?, must_change = ? WHERE id = ?')->execute([$hash, (int) $mustChange, $userId]);
    if ((int) ($_SESSION['uid'] ?? 0) === $userId) {
        $_SESSION['pwv'] = hash('sha256', $hash); // keep the person who changed it signed in
    }
    // A new password signs out every remembered device and kills old links.
    $db->prepare('DELETE FROM auth_tokens WHERE user_id = ?')->execute([$userId]);
}

function erp_password_errors(string $password, string $confirm): array
{
    $errors = [];
    if (mb_strlen($password) < 10) {
        $errors[] = 'The password needs at least 10 characters.';
    }
    if ($password !== $confirm) {
        $errors[] = 'The two passwords do not match.';
    }
    return $errors;
}

// Plain-text e-mail through the host's mail(). Returns false if the server refused it.
function erp_mail(string $to, string $subject, string $body): bool
{
    $host = preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'flowsuit.net');
    $from = 'no-reply@' . $host;
    $headers = 'From: FlowSuit ERP <' . $from . ">\r\nReply-To: " . config('contact_email') . "\r\n"
        . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n";
    if (erp_secret('erp_mail_log')) {
        // Testing only: copies every e-mail to flowsuit-data/mail.log.
        file_put_contents(erp_data_dir() . '/mail.log', "To: $to\nSubject: $subject\n\n$body\n----\n", FILE_APPEND);
    }
    return @mail($to, $subject, $body, $headers, '-f' . $from);
}

function erp_send_password_link(array $user, string $kind, bool $withCode = false): array
{
    $invite = $kind === 'invite';
    $token = erp_token_create((int) $user['id'], $kind, $invite ? ERP_INVITE_HOURS * 3600 : ERP_RESET_MINUTES * 60);
    $link = erp_base_url() . '/erp/reset?t=' . $token;
    $code = '';
    if ($withCode) {
        // The same reset can be done by typing a 6-digit code on the page that asked for it.
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $_SESSION['otp_reset'] = ['uid' => (int) $user['id'], 'hash' => hash('sha256', $code), 'token' => $token,
            'expires' => time() + ERP_OTP_MINUTES * 60, 'tries' => 0, 'sent' => time()];
    }
    $body = 'Hello ' . $user['name'] . ",\r\n\r\n"
        . ($invite ? "An account has been made for you in FlowSuit ERP. Choose your password here:\r\n"
            : "Someone asked to reset your FlowSuit ERP password. Choose a new one here:\r\n")
        . $link . "\r\n\r\n"
        . ($code !== '' ? 'Or type this code on the reset page: ' . $code . ' (works for ' . ERP_OTP_MINUTES . " minutes).\r\n\r\n" : '')
        . 'The link works once and stops working after ' . ($invite ? ERP_INVITE_HOURS . ' hours' : ERP_RESET_MINUTES . ' minutes') . ".\r\n"
        . ($invite ? '' : "If you did not ask for this, ignore this e-mail; your password stays the same.\r\n")
        . "\r\nFlowSuit ERP\r\n";
    $sent = erp_mail($user['email'], $invite ? 'Your FlowSuit ERP account' : 'Reset your FlowSuit ERP password', $body);
    return ['sent' => $sent, 'link' => $link];
}

// ---- Pages ----

function erp_forgot(bool $post): void
{
    $done = false;
    $error = null;
    $email = trim((string) ($_POST['email'] ?? ''));
    if ($post && ($_POST['action'] ?? '') === 'code') {
        $res = erp_otp_check('otp_reset', (string) ($_POST['code'] ?? ''));
        if (is_array($res) && $res['token'] !== '') {
            erp_redirect('/erp/reset?t=' . $res['token']);
        }
        $error = is_array($res) ? 'That code is not right.' : $res;
        $done = !empty($_SESSION['otp_reset']);
    } elseif ($post) {
        if (erp_too_many_attempts()) {
            $error = 'Too many tries. Wait 15 minutes and try again.';
        } else {
            // Counts toward the same limit as failed sign-ins, so nobody can flood an inbox.
            erp_db()->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([erp_ip(), time()]);
            $st = erp_db()->prepare('SELECT * FROM users WHERE email = ? AND active = 1');
            $st->execute([$email]);
            if ($row = $st->fetch()) {
                erp_send_password_link($row, 'reset', true);
            } else {
                // No account: a code that can never match, so the page behaves the same.
                $_SESSION['otp_reset'] = ['uid' => 0, 'hash' => bin2hex(random_bytes(32)), 'token' => '',
                    'expires' => time() + ERP_OTP_MINUTES * 60, 'tries' => 0, 'sent' => time()];
            }
            $done = true; // the same answer whether or not the e-mail has an account
        }
    }
    erp_render('forgot', ['done' => $done, 'error' => $error, 'email' => $email]);
}

function erp_reset(bool $post): void
{
    $token = (string) ($_GET['t'] ?? $_POST['t'] ?? '');
    $row = erp_token_user($token, ['reset', 'invite']);
    $errors = [];
    if ($row && $post) {
        $password = (string) ($_POST['password'] ?? '');
        $errors = erp_password_errors($password, (string) ($_POST['confirm'] ?? ''));
        if (!$errors) {
            erp_sign_in($row);
            erp_set_password((int) $row['id'], $password);
            erp_flash('Your new password is saved. Welcome, ' . strtok($row['name'], ' ') . '.');
            erp_redirect(erp_start_page(['must_change' => 0] + $row));
        }
    }
    erp_render('reset', ['row' => $row, 'token' => $token, 'errors' => $errors]);
}

// Change password while signed in; also where "must change at next sign-in" lands.
function erp_account(bool $post): void
{
    $me = erp_require_user(false);
    $errors = [];
    if ($post) {
        $password = (string) ($_POST['password'] ?? '');
        if (!password_verify((string) ($_POST['current'] ?? ''), $me['password_hash'])) {
            $errors[] = 'Your current password is not right.';
        }
        $errors = array_merge($errors, erp_password_errors($password, (string) ($_POST['confirm'] ?? '')));
        if (!$errors) {
            erp_set_password((int) $me['id'], $password);
            if (!empty($_COOKIE[ERP_REMEMBER_COOKIE])) {
                erp_remember_set((int) $me['id']); // keep this device remembered
            }
            erp_flash('Your new password is saved.');
            erp_redirect('/erp');
        }
    }
    erp_render('account', ['me' => $me, 'errors' => $errors]);
}

// The client's crest for the sign-in screen, taken from the uploaded TAJ dashboard so it never sits in the repository.
function erp_brand_logo(): void
{
    $html = erp_dashboard_file();
    $png = erp_data_dir() . '/brand-logo.png';
    if (is_file($html) && (!is_file($png) || filemtime($png) < filemtime($html))) {
        $src = file_get_contents($html, false, null, 0, 300000);
        if (preg_match('/class="lcrest" src="data:image\/png;base64,([A-Za-z0-9+\/=]+)"/', $src, $m)
            || preg_match('/data:image\/png;base64,([A-Za-z0-9+\/=]{200,})/', $src, $m)) {
            file_put_contents($png, base64_decode($m[1]));
        }
    }
    if (!is_file($png)) {
        header('Location: /assets/logo/flowsuit-mark.svg', true, 302);
        exit;
    }
    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=3600');
    header('Content-Length: ' . filesize($png));
    readfile($png);
    exit;
}

// ---- E-mailed one-time codes (OTP) ----
// Sign-in can ask for a 6-digit code sent to the user's e-mail. An admin switches it on from
// Security only after a test code reached their own inbox, so a broken mail server cannot lock
// everyone out. Emergency switch: 'erp_otp_off' => true in ~/flowsuit-secrets.php.

const ERP_OTP_MINUTES = 10;
const ERP_OTP_TRIES = 5;

function erp_setting(string $name): ?string
{
    $db = erp_db();
    $db->exec('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
    $st = $db->prepare('SELECT value FROM settings WHERE name = ?');
    $st->execute([$name]);
    $v = $st->fetchColumn();
    return $v === false ? null : (string) $v;
}

function erp_setting_set(string $name, ?string $value): void
{
    erp_setting($name); // makes sure the table exists
    if ($value === null) {
        erp_db()->prepare('DELETE FROM settings WHERE name = ?')->execute([$name]);
        return;
    }
    erp_db()->prepare('INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value')
        ->execute([$name, $value]);
}

function erp_otp_on(): bool
{
    return erp_setting('otp_login') === '1' && !erp_secret('erp_otp_off');
}

// Makes a code, keeps its hash in the session under $slot, and e-mails it. Returns whether mail() accepted it.
function erp_otp_send(string $slot, array $user, string $purpose, array $extra = []): bool
{
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $_SESSION[$slot] = $extra + ['uid' => (int) $user['id'], 'hash' => hash('sha256', $code),
        'expires' => time() + ERP_OTP_MINUTES * 60, 'tries' => 0, 'sent' => time()];
    $body = 'Hello ' . $user['name'] . ",\r\n\r\nYour FlowSuit ERP code " . $purpose . " is:\r\n\r\n    " . $code . "\r\n\r\n"
        . 'It works for ' . ERP_OTP_MINUTES . " minutes. Never share it; FlowSuit will never ask you for it.\r\n"
        . "If you did not ask for this, someone may know your password: change it.\r\n\r\nFlowSuit ERP\r\n";
    return erp_mail($user['email'], $code . ' is your FlowSuit ERP code', $body);
}

// Checks a typed code against the session slot. Returns the slot on success, an error message otherwise.
function erp_otp_check(string $slot, string $typed)
{
    $otp = $_SESSION[$slot] ?? null;
    if (!$otp || $otp['expires'] < time()) {
        unset($_SESSION[$slot]);
        return 'The code has expired. Ask for a new one.';
    }
    if ($otp['tries'] >= ERP_OTP_TRIES) {
        unset($_SESSION[$slot]);
        return 'Too many wrong codes. Ask for a new one.';
    }
    $_SESSION[$slot]['tries']++;
    if (!hash_equals($otp['hash'], hash('sha256', preg_replace('/\D/', '', $typed)))) {
        return 'That code is not right. ' . (ERP_OTP_TRIES - $_SESSION[$slot]['tries']) . ' tries left.';
    }
    unset($_SESSION[$slot]);
    return $otp;
}

function erp_user_by_id(int $id): ?array
{
    $st = erp_db()->prepare('SELECT * FROM users WHERE id = ? AND active = 1');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

// /erp/verify: second step of sign-in.
function erp_verify(bool $post): void
{
    $pending = $_SESSION['otp_login'] ?? null;
    $user = $pending ? erp_user_by_id($pending['uid']) : null;
    if (!$user) {
        erp_redirect('/erp/login');
    }
    $error = null;
    $notice = null;
    if ($post && ($_POST['action'] ?? '') === 'resend') {
        if (time() - $pending['sent'] < 60) {
            $error = 'Wait a minute before asking for another code.';
        } else {
            $notice = erp_otp_send('otp_login', $user, 'to sign in', ['remember' => $pending['remember']])
                ? 'A new code is on its way.' : 'The server could not send the e-mail. Ask your admin.';
        }
    } elseif ($post) {
        $res = erp_otp_check('otp_login', (string) ($_POST['code'] ?? ''));
        if (is_array($res)) {
            erp_sign_in($user);
            if ($res['remember']) {
                erp_remember_set((int) $user['id']);
            }
            erp_redirect(erp_start_page($user));
        }
        $error = $res;
        if (empty($_SESSION['otp_login'])) {
            erp_flash($error);
            erp_redirect('/erp/login');
        }
    }
    erp_render('verify', ['email' => $user['email'], 'error' => $error, 'notice' => $notice]);
}

// /erp/security: admin turns e-mail codes on (after a test) or off.
function erp_security(bool $post): void
{
    $me = erp_require_admin();
    $error = null;
    $action = $_POST['action'] ?? '';
    if ($post && $action === 'test') {
        if (!erp_otp_send('otp_test', $me, 'to switch on sign-in codes')) {
            $error = 'The server refused to send the e-mail, so codes cannot be switched on yet.';
        }
    } elseif ($post && $action === 'confirm') {
        $res = erp_otp_check('otp_test', (string) ($_POST['code'] ?? ''));
        if (is_array($res)) {
            erp_setting_set('otp_login', '1');
            erp_flash('Sign-in codes are on. Everyone gets a code by e-mail when they sign in.');
            erp_redirect('/erp/security');
        }
        $error = $res;
    } elseif ($post && $action === 'off') {
        erp_setting_set('otp_login', null);
        erp_flash('Sign-in codes are off.');
        erp_redirect('/erp/security');
    }
    erp_render('security', ['me' => $me, 'on' => erp_otp_on(), 'testing' => !empty($_SESSION['otp_test']),
        'forcedOff' => (bool) erp_secret('erp_otp_off'), 'error' => $error]);
}
