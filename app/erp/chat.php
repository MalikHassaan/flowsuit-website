<?php
// Staff chat: one-to-one and group conversations between ERP users, with files.
// Everything is kept: a message someone deletes is hidden from the chat but stays in the admin's Chat log.
// The chat window (chat.js) sits on every ERP page and inside the TAJ and HSEC apps, and polls /erp/chat/api.

const CHAT_MAX_FILE = 10 * 1024 * 1024; // bytes
const CHAT_BLOCKED = ['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'ps1', 'sh', 'jar',
    'php', 'phtml', 'phar', 'htm', 'html', 'xhtml', 'svg', 'shtml', 'hta', 'dll', 'reg', 'lnk'];
const CHAT_IMAGES = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp'];

function chat_schema(PDO $db): void
{
    $db->exec('CREATE TABLE IF NOT EXISTS chat_rooms (
        id INTEGER PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL DEFAULT \'\', dm_key TEXT UNIQUE,
        created_by INTEGER, created_at TEXT NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS chat_members (
        room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE, user_id INTEGER NOT NULL,
        last_read INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (room_id, user_id))');
    $db->exec('CREATE TABLE IF NOT EXISTS chat_files (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, size INTEGER NOT NULL, stored TEXT NOT NULL,
        uploaded_by INTEGER, created_at TEXT NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL, body TEXT NOT NULL DEFAULT \'\', file_id INTEGER, created_at TEXT NOT NULL, deleted_at TEXT)');
    $db->exec('CREATE INDEX IF NOT EXISTS chat_messages_room ON chat_messages (room_id, id)');
}

function chat_files_dir(): string
{
    $dir = erp_data_dir() . '/chat-files';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    return $dir;
}

// What chat.js needs on the page.
function chat_inject(array $me): string
{
    if ($me['must_change']) {
        return '';
    }
    $flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES;
    $cfg = ['api' => '/erp/chat/api', 'csrf' => $_SESSION['csrf'], 'uid' => (int) $me['id'], 'admin' => (bool) $me['is_admin'], 'max' => CHAT_MAX_FILE];
    return '<style>' . file_get_contents(__DIR__ . '/chat.css') . '</style><script>window.FS_CHAT=' . json_encode($cfg, $flags) . ";\n"
        . file_get_contents(__DIR__ . '/chat.js') . '</script>' . att_inject($me);
}

function chat_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function chat_member(int $room, int $uid): bool
{
    $st = erp_db()->prepare('SELECT 1 FROM chat_members WHERE room_id = ? AND user_id = ?');
    $st->execute([$room, $uid]);
    return (bool) $st->fetchColumn();
}

function chat_names(): array
{
    return array_column(erp_db()->query('SELECT id, name FROM users')->fetchAll(), 'name', 'id');
}

// A message as the chat window shows it. Deleted text is only kept for the Chat log.
function chat_out(array $m, array $names, bool $withDeleted = false): array
{
    $file = null;
    if ($m['file_id'] && (!$m['deleted_at'] || $withDeleted)) {
        $ext = strtolower(pathinfo($m['fname'], PATHINFO_EXTENSION));
        $file = ['id' => (int) $m['file_id'], 'name' => $m['fname'], 'size' => (int) $m['fsize'], 'image' => isset(CHAT_IMAGES[$ext])];
    }
    return ['id' => (int) $m['id'], 'room' => (int) $m['room_id'], 'uid' => (int) $m['user_id'], 'name' => $names[$m['user_id']] ?? 'Removed user',
        'body' => $m['deleted_at'] && !$withDeleted ? '' : $m['body'], 'file' => $file, 'at' => $m['created_at'], 'del' => (bool) $m['deleted_at']];
}

const CHAT_MSG_SQL = 'SELECT m.*, f.name AS fname, f.size AS fsize FROM chat_messages m LEFT JOIN chat_files f ON f.id = m.file_id';

// The person's conversations, newest activity first, with unread counts.
function chat_rooms_for(int $uid, array $names): array
{
    $st = erp_db()->prepare('SELECT r.id, r.kind, r.name, cm.last_read,
            (SELECT MAX(id) FROM chat_messages WHERE room_id = r.id) AS last_id,
            (SELECT COUNT(*) FROM chat_messages WHERE room_id = r.id AND id > cm.last_read AND user_id <> cm.user_id) AS unread
        FROM chat_rooms r JOIN chat_members cm ON cm.room_id = r.id AND cm.user_id = ? ORDER BY COALESCE(last_id, 0) DESC, r.id DESC');
    $st->execute([$uid]);
    $rooms = $st->fetchAll();
    $mem = erp_db()->prepare('SELECT user_id FROM chat_members WHERE room_id = ?');
    $last = erp_db()->prepare(CHAT_MSG_SQL . ' WHERE m.id = ?');
    $out = [];
    foreach ($rooms as $r) {
        $mem->execute([$r['id']]);
        $members = array_map('intval', $mem->fetchAll(PDO::FETCH_COLUMN));
        $name = $r['name'];
        if ($r['kind'] === 'dm') {
            $other = array_values(array_diff($members, [$uid]))[0] ?? $uid;
            $name = $names[$other] ?? 'Removed user';
        }
        $preview = null;
        if ($r['last_id']) {
            $last->execute([$r['last_id']]);
            $preview = chat_out($last->fetch(), $names);
        }
        $out[] = ['id' => (int) $r['id'], 'kind' => $r['kind'], 'name' => $name, 'members' => $members,
            'unread' => (int) $r['unread'], 'last' => $preview];
    }
    return $out;
}

function chat_api(string $sub): void
{
    $me = erp_user();
    if (!$me || $me['must_change']) {
        chat_json(['error' => 'Signed out'], 401);
    }
    $uid = (int) $me['id'];
    $db = erp_db();
    session_write_close(); // polling must not hold the session lock while other tabs load
    $post = $_SERVER['REQUEST_METHOD'] === 'POST';
    $in = $post && str_starts_with((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')
        ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : $_POST;
    $names = chat_names();

    if ($sub === '/poll') {
        att_reminders_maybe();
        // New messages in this person's conversations since the last poll; the first poll only learns where "now" is.
        $after = (int) ($_GET['after'] ?? 0);
        $max = (int) $db->query('SELECT COALESCE(MAX(id), 0) FROM chat_messages')->fetchColumn();
        $msgs = [];
        if ($after > 0) {
            $st = $db->prepare(CHAT_MSG_SQL . ' JOIN chat_members cm ON cm.room_id = m.room_id AND cm.user_id = ? WHERE m.id > ? ORDER BY m.id LIMIT 300');
            $st->execute([$uid, $after]);
            $msgs = array_map(fn($m) => chat_out($m, $names), $st->fetchAll());
            // Deletions since the last poll, so open windows hide them too.
            $st = $db->prepare(CHAT_MSG_SQL . ' JOIN chat_members cm ON cm.room_id = m.room_id AND cm.user_id = ? WHERE m.deleted_at >= ? AND m.id <= ?');
            $st->execute([$uid, date('Y-m-d H:i:s', time() - 60), $after]);
            foreach ($st->fetchAll() as $m) {
                $msgs[] = chat_out($m, $names);
            }
        }
        $people = $db->query('SELECT id, name FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE')->fetchAll();
        chat_json(['max' => $max, 'msgs' => $msgs, 'rooms' => chat_rooms_for($uid, $names),
            'people' => array_values(array_filter(array_map(fn($p) => ['id' => (int) $p['id'], 'name' => $p['name']], $people), fn($p) => $p['id'] !== $uid))]);
    }

    if ($sub === '/history') {
        $room = (int) ($_GET['room'] ?? 0);
        if (!chat_member($room, $uid)) {
            chat_json(['error' => 'Not in this chat'], 403);
        }
        $before = (int) ($_GET['before'] ?? 0) ?: PHP_INT_MAX;
        $st = $db->prepare(CHAT_MSG_SQL . ' WHERE m.room_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT 60');
        $st->execute([$room, $before]);
        chat_json(['msgs' => array_reverse(array_map(fn($m) => chat_out($m, $names), $st->fetchAll()))]);
    }

    if (preg_match('#^/file/(\d+)$#', $sub, $m)) {
        chat_send_file((int) $m[1], $me);
    }

    if (!$post) {
        chat_json(['error' => 'Not found'], 404);
    }

    if ($sub === '/open') {
        // A one-to-one chat with someone, created the first time.
        $other = (int) ($in['user'] ?? 0);
        if ($other === $uid || !isset($names[$other])) {
            chat_json(['error' => 'Pick someone to chat with.'], 400);
        }
        $key = min($uid, $other) . '-' . max($uid, $other);
        $st = $db->prepare('SELECT id FROM chat_rooms WHERE dm_key = ?');
        $st->execute([$key]);
        $room = (int) $st->fetchColumn();
        if (!$room) {
            $db->beginTransaction();
            $db->prepare("INSERT INTO chat_rooms (kind, dm_key, created_by, created_at) VALUES ('dm', ?, ?, ?)")->execute([$key, $uid, erp_now()]);
            $room = (int) $db->lastInsertId();
            $add = $db->prepare('INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)');
            $add->execute([$room, $uid]);
            $add->execute([$room, $other]);
            $db->commit();
        }
        chat_json(['room' => $room]);
    }

    if ($sub === '/group') {
        $name = trim(mb_substr((string) ($in['name'] ?? ''), 0, 60));
        $members = array_values(array_unique(array_filter(array_map('intval', (array) ($in['members'] ?? [])), fn($id) => isset($names[$id]) && $id !== $uid)));
        if ($name === '' || !$members) {
            chat_json(['error' => 'Give the group a name and pick at least one person.'], 400);
        }
        $db->beginTransaction();
        $db->prepare("INSERT INTO chat_rooms (kind, name, created_by, created_at) VALUES ('group', ?, ?, ?)")->execute([$name, $uid, erp_now()]);
        $room = (int) $db->lastInsertId();
        $add = $db->prepare('INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)');
        foreach (array_merge([$uid], $members) as $id) {
            $add->execute([$room, $id]);
        }
        $db->commit();
        chat_json(['room' => $room]);
    }

    $room = (int) ($in['room'] ?? 0);
    if (!chat_member($room, $uid)) {
        chat_json(['error' => 'Not in this chat'], 403);
    }

    if ($sub === '/send') {
        $body = trim(mb_substr((string) ($in['body'] ?? ''), 0, 4000));
        $fileId = null;
        if (!empty($_FILES['file']) && $_FILES['file']['error'] !== UPLOAD_ERR_NO_FILE) {
            $f = $_FILES['file'];
            if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE || $f['size'] > CHAT_MAX_FILE) {
                chat_json(['error' => 'That file is too big. The limit is ' . (CHAT_MAX_FILE >> 20) . ' MB.'], 400);
            }
            if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
                chat_json(['error' => 'The file did not upload. Try again.'], 400);
            }
            $fname = mb_substr(preg_replace('/[\x00-\x1f"\\\\\/]/u', '', basename((string) $f['name'])) ?: 'file', -120);
            if (in_array(strtolower(pathinfo($fname, PATHINFO_EXTENSION)), CHAT_BLOCKED, true)) {
                chat_json(['error' => 'Programs and web pages cannot be sent in the chat. Zip the file first if it is safe.'], 400);
            }
            $stored = bin2hex(random_bytes(16));
            if (!move_uploaded_file($f['tmp_name'], chat_files_dir() . '/' . $stored)) {
                chat_json(['error' => 'The server could not save the file.'], 500);
            }
            $db->prepare('INSERT INTO chat_files (name, size, stored, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?)')
                ->execute([$fname, (int) $f['size'], $stored, $uid, erp_now()]);
            $fileId = (int) $db->lastInsertId();
        }
        if ($body === '' && !$fileId) {
            chat_json(['error' => 'Type a message or attach a file.'], 400);
        }
        $db->prepare('INSERT INTO chat_messages (room_id, user_id, body, file_id, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$room, $uid, $body, $fileId, erp_now()]);
        $id = (int) $db->lastInsertId();
        $db->prepare('UPDATE chat_members SET last_read = ? WHERE room_id = ? AND user_id = ?')->execute([$id, $room, $uid]);
        $st = $db->prepare(CHAT_MSG_SQL . ' WHERE m.id = ?');
        $st->execute([$id]);
        chat_json(['msg' => chat_out($st->fetch(), $names)]);
    }

    if ($sub === '/read') {
        $db->prepare('UPDATE chat_members SET last_read = MAX(last_read, ?) WHERE room_id = ? AND user_id = ?')
            ->execute([(int) ($in['upto'] ?? 0), $room, $uid]);
        chat_json(['ok' => true]);
    }

    if ($sub === '/delete') {
        // Only your own messages, and only hidden: the Chat log keeps the original.
        $db->prepare('UPDATE chat_messages SET deleted_at = ? WHERE id = ? AND room_id = ? AND user_id = ? AND deleted_at IS NULL')
            ->execute([erp_now(), (int) ($in['id'] ?? 0), $room, $uid]);
        chat_json(['ok' => true]);
    }

    chat_json(['error' => 'Not found'], 404);
}

// Members of the chat can open its files; admins can open every file (from the Chat log).
function chat_send_file(int $id, array $me): void
{
    $st = erp_db()->prepare('SELECT f.*, m.room_id, m.deleted_at FROM chat_files f JOIN chat_messages m ON m.file_id = f.id WHERE f.id = ?');
    $st->execute([$id]);
    $f = $st->fetch();
    if (!$f || (!$me['is_admin'] && ($f['deleted_at'] || !chat_member((int) $f['room_id'], (int) $me['id'])))) {
        chat_json(['error' => 'File not found'], 404);
    }
    $path = chat_files_dir() . '/' . $f['stored'];
    if (!is_file($path)) {
        chat_json(['error' => 'File not found'], 404);
    }
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    $inline = isset(CHAT_IMAGES[$ext]) && empty($_GET['dl']);
    header('Content-Type: ' . ($inline ? CHAT_IMAGES[$ext] : 'application/octet-stream'));
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; sandbox");
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . "; filename*=UTF-8''" . rawurlencode($f['name']));
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, max-age=86400');
    readfile($path);
    exit;
}

// Admin: every conversation, including deleted messages, with a CSV download.
function chat_log_page(): void
{
    $me = erp_require_admin();
    $db = erp_db();
    $names = chat_names();
    $room = (int) ($_GET['room'] ?? 0);
    if ($room) {
        $st = $db->prepare('SELECT * FROM chat_rooms WHERE id = ?');
        $st->execute([$room]);
        $r = $st->fetch();
        if (!$r) {
            erp_render('notfound', [], 404);
            return;
        }
        $mem = $db->prepare('SELECT user_id FROM chat_members WHERE room_id = ?');
        $mem->execute([$room]);
        $members = array_map(fn($id) => $names[$id] ?? 'Removed user', $mem->fetchAll(PDO::FETCH_COLUMN));
        $st = $db->prepare(CHAT_MSG_SQL . ' WHERE m.room_id = ? ORDER BY m.id');
        $st->execute([$room]);
        $msgs = array_map(fn($m) => chat_out($m, $names, true) + ['deleted_at' => $m['deleted_at']], $st->fetchAll());
        $title = $r['kind'] === 'dm' ? implode(' and ', $members) : $r['name'];
        if (($_GET['csv'] ?? '') === '1') {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="chat-' . $room . '-' . date('Y-m-d') . '.csv"');
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Sent', 'From', 'Message', 'File', 'Deleted']);
            foreach ($msgs as $m) {
                fputcsv($out, array_map(fn($v) => preg_match('/^[=+\-@\t\r]/', (string) $v) ? "'" . $v : $v, // no spreadsheet formulas
                    [$m['at'], $m['name'], $m['body'], $m['file']['name'] ?? '', $m['deleted_at'] ?? '']));
            }
            exit;
        }
        erp_render('chat-log', ['me' => $me, 'room' => $r, 'roomTitle' => $title, 'members' => $members, 'msgs' => $msgs]);
        return;
    }
    $rooms = $db->query('SELECT r.*, (SELECT COUNT(*) FROM chat_messages WHERE room_id = r.id) AS n,
            (SELECT MAX(created_at) FROM chat_messages WHERE room_id = r.id) AS last_at
        FROM chat_rooms r ORDER BY COALESCE(last_at, r.created_at) DESC')->fetchAll();
    $mem = $db->prepare('SELECT user_id FROM chat_members WHERE room_id = ?');
    foreach ($rooms as &$r) {
        $mem->execute([$r['id']]);
        $r['members'] = array_map(fn($id) => $names[$id] ?? 'Removed user', $mem->fetchAll(PDO::FETCH_COLUMN));
    }
    unset($r);
    erp_render('chat-log', ['me' => $me, 'rooms' => $rooms]);
}
