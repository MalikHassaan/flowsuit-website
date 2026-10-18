<?php
// Shared storage for the TAJ dashboard. The dashboard saves through a small document store
// (uploads, state, settings, history, desk, audit) and JSON files of the parsed exports.
// taj-bridge.js connects it to these endpoints, so every ERP user with access sees the same data.
// Documents live in erp.sqlite; export files in ~/flowsuit-data/taj-assets. Nothing is in the repository.

const TAJ_COLLECTIONS = ['uploads', 'state', 'settings', 'history', 'desk', 'audit'];
const TAJ_MAX_DOC = 2 * 1024 * 1024;     // bytes of JSON per document
const TAJ_MAX_ASSET = 15 * 1024 * 1024;  // bytes per uploaded export, as sent
const TAJ_MAX_JSON = 80 * 1024 * 1024;   // bytes per export once unzipped

function taj_db(): PDO
{
    $db = erp_db();
    $db->exec('CREATE TABLE IF NOT EXISTS taj_docs (
        path TEXT PRIMARY KEY, coll TEXT NOT NULL, data TEXT, ver INTEGER NOT NULL,
        updated_by INTEGER, updated_at TEXT NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS taj_docs_ver ON taj_docs (ver)');
    return $db;
}

function taj_uid(array $user): string
{
    return 'u' . $user['id'];
}

// What the dashboard calls the signed-in person: their e-mail, lower case.
function taj_username(array $user): string
{
    return strtolower($user['email']);
}

// The dashboard's own access levels, matched to ERP access. User management stays in the ERP.
function taj_rights(array $user): array
{
    $rights = ['pdf' => true, 'data' => true];
    if (erp_can($user, 'receivables', 'edit')) {
        $rights += ['upload' => true, 'restore' => true];
    }
    if ($user['is_admin']) {
        $rights += ['audit' => true, 'users' => true];
    }
    return $rights;
}

// The dashboard checks the signed-in person against auth/users; it only needs to find itself.
function taj_users_doc(array $me): array
{
    $role = $me['is_admin'] ? 'Admin' : (erp_can($me, 'receivables', 'edit') ? 'Editor' : 'Data viewer');
    return ['list' => [['u' => taj_username($me), 'name' => $me['name'], 'role' => $role,
        'rights' => taj_rights($me), 'active' => true]]];
}

// Script placed before </head>: skips the dashboard's own sign-in and connects shared storage.
function taj_inject(array $me): string
{
    $flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES;
    $cfg = ['api' => '/erp/m/receivables/api', 'csrf' => $_SESSION['csrf'], 'uid' => taj_uid($me),
        'edit' => erp_can($me, 'receivables', 'edit'), 'name' => $me['name']];
    return '<script>try{sessionStorage.setItem("taj-in",' . json_encode(taj_username($me), $flags) . ')}catch(e){}'
        . 'window.FS_TAJ=' . json_encode($cfg, $flags) . ";\n"
        . file_get_contents(__DIR__ . '/taj-bridge.js') . '</script>'
        // Sign-out and user management happen in the ERP itself.
        . '<style>#lock,[data-tab="users"],.mod:has([data-mod="admin"]){display:none!important}'
        . '.fs-erp-back{position:fixed;left:16px;bottom:44px;z-index:9999;display:flex;gap:6px;font:600 13px system-ui,sans-serif}'
        . '.fs-erp-back a{background:#1F6FB8;color:#fff;text-decoration:none;padding:8px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(15,23,42,.25)}'
        . '.fs-erp-back a+a{background:#fff;color:#3730a3}</style>'
        // The dashboard opens full screen, so give a way back to the ERP (not needed inside a frame).
        . '<script>addEventListener("DOMContentLoaded",function(){if(window.top!==window)return;var d=document.createElement("div");d.className="fs-erp-back";'
        . 'd.innerHTML=\'<a href="/erp">&larr; FlowSuit ERP</a>' . ($me['is_admin'] ? '<a href="/erp/m/receivables?manage=1">Replace file</a>' : '') . '\';document.body.appendChild(d);});</script>';
}

// The dashboard was written for claude.ai sharing; inside the ERP, access comes from Users and access.
function taj_wording(string $html): string
{
    return strtr($html, [
        'ask the report owner to raise your access in the Share menu.' => 'ask an ERP admin for View and upload access.',
        '>claude.ai account</th>' => '>ERP account</th>',
        '"claude.ai account: "' => '"ERP account: "',
        '", on a claude.ai Editor account,"' => '", as an ERP admin,"',
        '" on a claude.ai Editor account"' => '" as an ERP admin"',
        '" and claude.ai Editor access"' => '" and View and upload access in the ERP"',
    ]);
}

function taj_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (strlen($body) > 32768 && function_exists('gzencode') && stripos($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip') !== false) {
        ini_set('zlib.output_compression', '0');
        $body = gzencode($body, 6);
        header('Content-Encoding: gzip');
        header('Vary: Accept-Encoding');
    }
    header('Content-Length: ' . strlen($body));
    echo $body;
    exit;
}

function taj_fail(int $status, string $code, string $message): void
{
    taj_json(['code' => $code, 'error' => $message], $status);
}

function taj_api(string $rest): void
{
    $me = erp_user();
    if (!$me) {
        taj_fail(401, 'unauthenticated', 'Your ERP session has ended. Reload the page and sign in again');
    }
    if (!erp_can($me, 'receivables')) {
        taj_fail(403, 'permission_denied', 'You do not have access to TAJ Receivables');
    }
    $method = $_SERVER['REQUEST_METHOD'];
    if ($rest === '/sync' && $method === 'GET') {
        taj_sync($me, max(0, (int) ($_GET['v'] ?? 0)));
    } elseif ($rest === '/doc' && $method === 'POST') {
        taj_write($me);
    } elseif ($rest === '/asset' && $method === 'POST') {
        taj_asset_upload($me);
    } elseif (preg_match('#^/blob/([a-f0-9]{32})$#', $rest, $m) && $method === 'GET') {
        taj_asset_send($m[1]);
    }
    taj_fail(404, 'not_found', 'Unknown request');
}

// Every document changed after version $since (deleted ones come back with data null).
function taj_sync(array $me, int $since): void
{
    $db = taj_db();
    $v = (int) $db->query('SELECT COALESCE(MAX(ver), 0) FROM taj_docs')->fetchColumn();
    $st = $since
        ? $db->prepare('SELECT path, coll, data FROM taj_docs WHERE ver > ? ORDER BY ver')
        : $db->prepare('SELECT path, coll, data FROM taj_docs WHERE ver > ? AND data IS NOT NULL');
    $st->execute([$since]);
    $own = 'audit/' . taj_uid($me);
    $docs = [];
    foreach ($st->fetchAll() as $row) {
        // Only admins read everyone's audit trail; others see their own entries.
        if ($row['coll'] === 'audit' && !$me['is_admin'] && $row['path'] !== $own) {
            continue;
        }
        $docs[] = ['path' => $row['path'], 'data' => $row['data'] === null ? null : json_decode($row['data'])];
    }
    $out = ['v' => $v, 'docs' => $docs];
    if (!$since) {
        $out['docs'][] = ['path' => 'auth/users', 'data' => taj_users_doc($me)];
        $names = [];
        foreach ($db->query('SELECT id, name FROM users') as $u) {
            $names['u' . $u['id']] = $u['name'];
        }
        $out['names'] = $names;
    }
    taj_json($out);
}

function taj_write(array $me): void
{
    $in = json_decode((string) file_get_contents('php://input'));
    $op = $in->op ?? '';
    $path = (string) ($in->path ?? '');
    if (!in_array($op, ['set', 'update', 'delete'], true) || !preg_match('#^([a-z]+)/([A-Za-z0-9_-]{1,64})$#', $path, $m)) {
        taj_fail(400, 'invalid_argument', 'Bad request');
    }
    $coll = $m[1];
    if ($coll === 'auth') {
        taj_fail(403, 'permission_denied', 'Users are managed in the ERP under Users and access');
    }
    if (!in_array($coll, TAJ_COLLECTIONS, true)) {
        taj_fail(400, 'invalid_argument', 'Unknown collection');
    }
    $allowed = match ($coll) {
        'audit' => $path === 'audit/' . taj_uid($me),
        'settings' => (bool) $me['is_admin'],
        default => erp_can($me, 'receivables', 'edit'),
    };
    if (!$allowed) {
        taj_fail(403, 'permission_denied', 'Your ERP access does not allow this change');
    }
    $data = $in->data ?? null;
    if ($op !== 'delete' && !($data instanceof stdClass)) {
        taj_fail(400, 'invalid_argument', 'Expected an object');
    }

    $db = taj_db();
    $db->exec('BEGIN IMMEDIATE');
    try {
        if ($op === 'update') {
            $st = $db->prepare('SELECT data FROM taj_docs WHERE path = ? AND data IS NOT NULL');
            $st->execute([$path]);
            $old = $st->fetchColumn();
            if ($old === false) {
                $db->exec('ROLLBACK');
                taj_fail(400, 'invalid_argument', 'No document to update');
            }
            $merged = json_decode($old);
            foreach (get_object_vars($data) as $k => $val) {
                $merged->$k = $val;
            }
            $data = $merged;
        }
        $json = $op === 'delete' ? null : json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json !== null && strlen($json) > TAJ_MAX_DOC) {
            $db->exec('ROLLBACK');
            taj_fail(400, 'resource_exhausted', 'This record is too large to save');
        }
        $v = (int) $db->query('SELECT COALESCE(MAX(ver), 0) + 1 FROM taj_docs')->fetchColumn();
        $db->prepare('INSERT INTO taj_docs (path, coll, data, ver, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET data = excluded.data, ver = excluded.ver,
            updated_by = excluded.updated_by, updated_at = excluded.updated_at')
            ->execute([$path, $coll, $json, $v, $me['id'], erp_now()]);
        $db->exec('COMMIT');
    } catch (Throwable $ex) {
        if ($db->inTransaction()) {
            $db->exec('ROLLBACK');
        }
        throw $ex;
    }
    taj_json(['ok' => true, 'v' => $v]);
}

function taj_asset_dir(): string
{
    $dir = erp_data_dir() . '/taj-assets';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    return $dir;
}

// One parsed export, sent by the dashboard as JSON (gzipped by the browser when it can).
function taj_asset_upload(array $me): void
{
    if (!erp_can($me, 'receivables', 'edit')) {
        taj_fail(403, 'permission_denied', 'Your ERP access is View only');
    }
    $body = (string) file_get_contents('php://input', false, null, 0, TAJ_MAX_ASSET + 1);
    if ($body === '' || strlen($body) > TAJ_MAX_ASSET) {
        taj_fail(400, 'resource_exhausted', 'The export is empty or larger than 15 MB');
    }
    $json = ($_SERVER['HTTP_X_BODY_GZIP'] ?? '') === '1' ? @gzdecode($body, TAJ_MAX_JSON) : $body;
    if ($json === false || json_decode($json) === null) {
        taj_fail(400, 'invalid_argument', 'The export could not be read');
    }
    $id = bin2hex(random_bytes(16));
    file_put_contents(taj_asset_dir() . '/' . $id . '.json.gz', gzencode($json, 6));
    taj_json(['id' => $id, 'sizeBytes' => strlen($json)]);
}

function taj_asset_send(string $id): void
{
    $file = taj_asset_dir() . '/' . $id . '.json.gz';
    if (!is_file($file)) {
        taj_fail(404, 'not_found', 'Saved file not found');
    }
    $gz = file_get_contents($file);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, max-age=31536000, immutable');
    if (stripos($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip') !== false) {
        ini_set('zlib.output_compression', '0');
        header('Content-Encoding: gzip');
        header('Vary: Accept-Encoding');
    } else {
        $gz = gzdecode($gz);
    }
    header('Content-Length: ' . strlen($gz));
    echo $gz;
    exit;
}
