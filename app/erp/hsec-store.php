<?php
// HSEC Finance ERP: a self-contained accounting app (built in the "HSEC restructure" project).
// Like TAJ, it was written to save through window.claude.use("db"); taj-bridge.js connects that to
// the endpoints below, so every ERP user with HSEC access shares one set of books.
// The app file lives in ~/flowsuit-data/modules/hsec.html and its records in erp.sqlite; neither is in the repository.
//
// Server rules the browser cannot get round (the same ones the app's own Supabase setup had):
//   * View only cannot change anything; settings and its Users & roles (secusers) are admin-only.
//   * A posted voucher cannot be deleted, and its date, company and lines cannot be changed.
//   * Every insert, change and delete goes to hsec_history, which nothing in the ERP edits or deletes.

const HSEC_MAX_DOC = 2 * 1024 * 1024;       // bytes of JSON per record
const HSEC_MAX_BACKUP = 60 * 1024 * 1024;   // bytes of a backup file once unzipped
const HSEC_OWNER_ONLY = ['settings', 'secusers'];

function hsec_db(): PDO
{
    $db = erp_db();
    $db->exec('CREATE TABLE IF NOT EXISTS hsec_docs (
        coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT, ver INTEGER NOT NULL,
        updated_by INTEGER, updated_at TEXT NOT NULL, PRIMARY KEY (coll, id))');
    $db->exec('CREATE INDEX IF NOT EXISTS hsec_docs_ver ON hsec_docs (ver)');
    $db->exec('CREATE TABLE IF NOT EXISTS hsec_history (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, by_user INTEGER, op TEXT NOT NULL,
        coll TEXT NOT NULL, id TEXT NOT NULL, old_data TEXT, new_data TEXT)');
    return $db;
}

// The HSEC companies this person may see, or null for all of them (admins always see all).
function hsec_allowed(array $me): ?array
{
    $ents = array_values(array_filter(explode(',', (string) ($me['hsec_ents'] ?? ''))));
    return $me['is_admin'] || !$ents ? null : $ents;
}

// False when a record belongs to a company this person may not see. Records without a company (shared
// accounts, vendors, setup) are open to everyone with HSEC access.
function hsec_visible(?array $allowed, ?array $data): bool
{
    return $allowed === null || $data === null || !isset($data['entity']) || !is_string($data['entity'])
        || $data['entity'] === '' || in_array($data['entity'], $allowed, true);
}

function hsec_file(): string
{
    return erp_data_dir() . '/modules/hsec.html';
}

// The HSEC emblem for the sign-in screens, taken from the uploaded app file (it is not in the repository).
function hsec_logo(): void
{
    $html = hsec_file();
    $png = erp_data_dir() . '/hsec-logo.png';
    if (is_file($html) && (!is_file($png) || filemtime($png) < filemtime($html))) {
        $src = (string) file_get_contents($html);
        if (preg_match('/HSEC_ICON\s*=\s*"data:image\/png;base64,([A-Za-z0-9+\/=]+)"/', $src, $m)) {
            file_put_contents($png, base64_decode($m[1]));
        }
    }
    if (!is_file($png)) {
        header('Location: /assets/logo/hsec-mark.svg', true, 302);
        exit;
    }
    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=3600');
    header('Content-Length: ' . filesize($png));
    readfile($png);
    exit;
}

// Script placed before </head>: connects shared storage, restyles the loading screen and adds the account menu
// to the app's top bar.
function hsec_inject(array $me): string
{
    $flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES;
    $cfg = ['api' => '/erp/m/hsec/api', 'csrf' => $_SESSION['csrf'], 'uid' => taj_uid($me), 'name' => $me['name'],
        'edit' => erp_can($me, 'hsec', 'edit'), 'owner' => (bool) $me['is_admin'], 'assets' => false];
    $allowed = hsec_allowed($me);
    return '<script>window.FS_BRIDGE=' . json_encode($cfg, $flags) . ";\n"
        // The app remembers the last company picked; if that is not one of theirs, start on their companies.
        . ($allowed === null ? '' : 'try{var fsE=' . json_encode($allowed, $flags) . ',fsC=localStorage.getItem("hsec-erp-ent");'
            . 'if(fsC!=="All"&&fsE.indexOf(fsC)<0)localStorage.setItem("hsec-erp-ent",fsE.length>1?"All":fsE[0]);}catch(e){}' . "\n")
        . file_get_contents(__DIR__ . '/taj-bridge.js') . '</script>'
        . erp_intro(['name' => 'HSEC', 'sub' => 'Finance & Accounting ERP', 'logo' => '/erp/hsec-logo', 'zoom' => '.app',
            'steps' => ['Securing connection', 'Verifying your access', 'Loading your books', 'Preparing your dashboard']])
        . '<style>' . file_get_contents(__DIR__ . '/hsec-present.css') . '</style><script>' . file_get_contents(__DIR__ . '/hsec-present.js') . '</script>'
        . '<style>.fs-acct{display:inline-flex;align-items:center;margin-left:10px}.fs-acct>button{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px 0 4px;border:1px solid var(--line,#E3E6EB);border-radius:999px;background:var(--panel,#fff);color:var(--ink,#1F2328);font:600 13px Poppins,system-ui,sans-serif;cursor:pointer}'
        . '.fs-acct>button i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#1F6FB8;color:#fff;font-style:normal;font-size:12px}'
        . '.fs-menu{position:fixed;z-index:10000;min-width:220px;padding:6px;border-radius:12px;background:#fff;box-shadow:0 18px 40px rgba(15,23,42,.25);border:1px solid #e2e8f0;font:500 14px system-ui,sans-serif}'
        . '.fs-menu[hidden]{display:none}.fs-menu p{margin:0;padding:8px 10px 10px;color:#64748b;font-size:12px;border-bottom:1px solid #eef2f7}.fs-menu p b{display:block;color:#0f172a;font-size:14px}'
        . '.fs-menu a,.fs-menu button{display:block;width:100%;text-align:left;padding:9px 10px;border:0;border-radius:8px;background:none;color:#0f172a;font:inherit;text-decoration:none;cursor:pointer}.fs-menu a:hover,.fs-menu button:hover{background:#f1f5f9}.fs-menu button{color:#b91c1c}</style>'
        . '<script>addEventListener("DOMContentLoaded",function(){var C=FS_BRIDGE,esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return"&#"+c.charCodeAt(0)+";"})};'
        . 'var m=document.createElement("div");m.className="fs-menu";m.hidden=true;m.setAttribute("role","menu");'
        . 'm.innerHTML="<p><b>"+esc(C.name)+"</b>Signed in to FlowSuit ERP</p><a href=\"/erp/account\">Change password</a><a href=\"/erp\">FlowSuit ERP home</a>"+(C.owner?"<a href=\"/erp/users\">Users and access</a><a href=\"/erp/m/hsec?manage=1\">Replace file or import a backup</a>":"")'
        . '+"<button type=\"button\" data-fs-out>Sign out</button>";document.body.appendChild(m);'
        // The app cancels every form submit on its page, so Sign out sends its own form directly.
        . 'm.querySelector("[data-fs-out]").addEventListener("click",function(){var f=document.createElement("form");f.method="post";f.action="/erp/logout";'
        . 'var i=document.createElement("input");i.type="hidden";i.name="csrf";i.value=C.csrf;f.appendChild(i);document.body.appendChild(f);HTMLFormElement.prototype.submit.call(f);});'
        // The app redraws its top bar, so the account button is put back whenever it goes missing.
        . 'function put(){var top=document.querySelector("#topbar");if(!top||top.querySelector(".fs-acct"))return;var s=document.createElement("span");s.className="fs-acct";'
        . 's.innerHTML="<button type=\"button\" aria-haspopup=\"true\" title=\"Account and sign out\"><i>"+esc(C.name.charAt(0).toUpperCase())+"</i>"+esc(C.name.split(" ")[0])+"</button>";top.appendChild(s);}'
        . 'put();new MutationObserver(put).observe(document.body,{childList:true,subtree:true});'
        . 'document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".fs-acct>button");if(b){e.preventDefault();if(!m.hidden){m.hidden=true;return;}var r=b.getBoundingClientRect();m.hidden=false;'
        . 'm.style.top=(r.bottom+8)+"px";m.style.left=Math.max(8,Math.min(r.right-m.offsetWidth,innerWidth-m.offsetWidth-8))+"px";return;}if(!m.contains(e.target))m.hidden=true;});'
        . 'document.addEventListener("keydown",function(e){if(e.key==="Escape")m.hidden=true;});});</script>';
}

// The app was written for claude.ai sharing; inside the ERP, access comes from Users and access.
function hsec_wording(string $html): string
{
    return strtr($html, [
        'Anyone you share the page with as an editor sees and changes the same data.' => 'Everyone with HSEC access in FlowSuit ERP sees and changes the same data.',
    ]);
}

function hsec_api(string $rest): void
{
    $me = erp_user();
    if (!$me) {
        taj_fail(401, 'unauthenticated', 'Your ERP session has ended. Reload the page and sign in again');
    }
    if (!erp_can($me, 'hsec')) {
        taj_fail(403, 'permission_denied', 'You do not have access to HSEC ERP');
    }
    $method = $_SERVER['REQUEST_METHOD'];
    if ($rest === '/sync' && $method === 'GET') {
        hsec_sync(max(0, (int) ($_GET['v'] ?? 0)));
    } elseif ($rest === '/doc' && $method === 'POST') {
        hsec_write($me);
    }
    taj_fail(404, 'not_found', 'Unknown request');
}

// Every record changed after version $since (deleted ones come back with data null).
function hsec_sync(int $since): void
{
    $db = hsec_db();
    $v = (int) $db->query('SELECT COALESCE(MAX(ver), 0) FROM hsec_docs')->fetchColumn();
    $st = $since
        ? $db->prepare('SELECT coll, id, data FROM hsec_docs WHERE ver > ? ORDER BY ver')
        : $db->prepare('SELECT coll, id, data FROM hsec_docs WHERE ver > ? AND data IS NOT NULL');
    $st->execute([$since]);
    $allowed = hsec_allowed(erp_user());
    $docs = [];
    foreach ($st->fetchAll() as $row) {
        $data = $row['data'] === null ? null : json_decode($row['data'], true);
        if (!hsec_visible($allowed, $data)) {
            // Another company's record: never sent. If it moved out of reach, the browser drops its copy.
            if ($since) {
                $docs[] = ['path' => $row['coll'] . '/' . $row['id'], 'data' => null];
            }
            continue;
        }
        if ($allowed !== null && $row['coll'] === 'settings' && $row['id'] === 'main' && is_array($data['entities'] ?? null)) {
            // The company picker only offers their companies; "All" is then the total of those.
            $data['entities'] = array_values(array_intersect($data['entities'], $allowed));
        }
        $docs[] = ['path' => $row['coll'] . '/' . $row['id'], 'data' => $row['data'] === null ? null : json_decode(json_encode($data))];
    }
    $out = ['v' => $v, 'docs' => $docs];
    if (!$since) {
        $names = [];
        $members = [];
        foreach ($db->query('SELECT id, name, email, is_admin, active FROM users ORDER BY name') as $u) {
            $names['u' . $u['id']] = $u['name'];
            $u['access'] = erp_access_for((int) $u['id']);
            if ($u['active'] && erp_can($u, 'hsec')) {
                $members[] = ['id' => 'u' . $u['id'], 'name' => $u['name'], 'email' => $u['email']];
            }
        }
        $out['names'] = $names;
        $out['members'] = $members;
    }
    taj_json($out);
}

// Why a change is refused, or null when it is allowed. $old and $new are decoded records (null = none).
function hsec_refusal(array $me, string $coll, ?array $old, ?array $new): ?string
{
    if (in_array($coll, HSEC_OWNER_ONLY, true) && !$me['is_admin']) {
        return 'Only an ERP admin can change the HSEC setup and its users and roles';
    }
    if (!erp_can($me, 'hsec', 'edit')) {
        return 'Your ERP access to HSEC ERP is view only';
    }
    $allowed = hsec_allowed($me);
    if (!hsec_visible($allowed, $old) || !hsec_visible($allowed, $new)) {
        return 'Your access is limited to ' . implode(', ', $allowed ?? []) . '. This record belongs to another company.';
    }
    if ($coll === 'journals' && $old !== null && ($old['status'] ?? '') === 'Posted') {
        if ($new === null) {
            return 'A posted voucher cannot be deleted. Post a reversing voucher instead.';
        }
        foreach (['lines', 'date', 'entity'] as $k) {
            if (($new[$k] ?? null) != ($old[$k] ?? null)) {
                return 'A posted voucher cannot be changed. Post a reversing voucher instead.';
            }
        }
    }
    return null;
}

// Writes one record and its history row; the caller holds the transaction.
function hsec_put(PDO $db, array $me, string $coll, string $id, ?string $json, ?string $oldJson, int $v): void
{
    $db->prepare('INSERT INTO hsec_docs (coll, id, data, ver, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, ver = excluded.ver,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at')
        ->execute([$coll, $id, $json, $v, $me['id'], erp_now()]);
    $op = $json === null ? 'DELETE' : ($oldJson === null ? 'INSERT' : 'UPDATE');
    $db->prepare('INSERT INTO hsec_history (at, by_user, op, coll, id, old_data, new_data) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([erp_now(), $me['id'], $op, $coll, $id, $oldJson, $json]);
}

function hsec_old(PDO $db, string $coll, string $id): ?string
{
    $st = $db->prepare('SELECT data FROM hsec_docs WHERE coll = ? AND id = ? AND data IS NOT NULL');
    $st->execute([$coll, $id]);
    $old = $st->fetchColumn();
    return $old === false ? null : $old;
}

function hsec_write(array $me): void
{
    $in = json_decode((string) file_get_contents('php://input'));
    $op = $in->op ?? '';
    $path = (string) ($in->path ?? '');
    if (!in_array($op, ['set', 'update', 'delete'], true) || !preg_match('#^([A-Za-z]{1,40})/([A-Za-z0-9_.:-]{1,100})$#', $path, $m)) {
        taj_fail(400, 'invalid_argument', 'Bad request');
    }
    [, $coll, $id] = $m;
    $data = $in->data ?? null;
    if ($op !== 'delete' && !($data instanceof stdClass)) {
        taj_fail(400, 'invalid_argument', 'Expected an object');
    }

    $db = hsec_db();
    $db->exec('BEGIN IMMEDIATE');
    try {
        $oldJson = hsec_old($db, $coll, $id);
        $old = $oldJson === null ? null : json_decode($oldJson, true);
        if ($op === 'update') {
            if ($old === null) {
                $db->exec('ROLLBACK');
                taj_fail(400, 'invalid_argument', 'No record to update');
            }
            $data = (object) array_merge($old, json_decode(json_encode($data), true));
        }
        $json = $op === 'delete' ? null : json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json !== null && strlen($json) > HSEC_MAX_DOC) {
            $db->exec('ROLLBACK');
            taj_fail(400, 'resource_exhausted', 'This record is too large to save');
        }
        $why = hsec_refusal($me, $coll, $old, $json === null ? null : json_decode($json, true));
        if ($why !== null) {
            $db->exec('ROLLBACK');
            taj_fail(403, 'permission_denied', $why);
        }
        if ($op === 'delete' && $old === null) {
            $db->exec('ROLLBACK');
            taj_json(['ok' => true]);
        }
        $v = (int) $db->query('SELECT COALESCE(MAX(ver), 0) + 1 FROM hsec_docs')->fetchColumn();
        hsec_put($db, $me, $coll, $id, $json, $oldJson, $v);
        $db->exec('COMMIT');
    } catch (Throwable $ex) {
        if ($db->inTransaction()) {
            $db->exec('ROLLBACK');
        }
        throw $ex;
    }
    taj_json(['ok' => true, 'v' => $v]);
}

function hsec_counts(): array
{
    $out = ['records' => 0, 'journals' => 0];
    foreach (hsec_db()->query('SELECT coll, COUNT(*) AS n FROM hsec_docs WHERE data IS NOT NULL GROUP BY coll') as $r) {
        $out['records'] += (int) $r['n'];
        if ($r['coll'] === 'journals') {
            $out['journals'] = (int) $r['n'];
        }
    }
    return $out;
}

// Loads a backup downloaded from the app (Setup › Security & audit › Backup & restore) in one go.
// Records come back with their original ids; a posted voucher that already differs here is left alone.
function hsec_import(array $me, string $path, string $name): array
{
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if ($ext === 'zip') {
        if (!class_exists('ZipArchive')) {
            throw new RuntimeException('This server cannot open .zip files. Upload the .json file itself.');
        }
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new RuntimeException('This is not a valid .zip file.');
        }
        $raw = null;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $st = $zip->statIndex($i);
            if (preg_match('/\.json$/i', $st['name']) && $st['size'] < HSEC_MAX_BACKUP) {
                $raw = $zip->getFromIndex($i);
                break;
            }
        }
        $zip->close();
        if (!is_string($raw)) {
            throw new RuntimeException('No backup .json file found inside the .zip.');
        }
    } elseif ($ext === 'json') {
        $raw = file_get_contents($path);
    } else {
        throw new RuntimeException('Upload the backup as .json (or a .zip holding it).');
    }
    $j = json_decode((string) $raw, true);
    if (!is_array($j) || ($j['app'] ?? '') !== 'HSEC Finance ERP' || !is_array($j['data'] ?? null)) {
        throw new RuntimeException('This is not an HSEC Finance ERP backup file.');
    }

    $db = hsec_db();
    $done = 0;
    $kept = 0;
    $db->exec('BEGIN IMMEDIATE');
    try {
        $v = (int) $db->query('SELECT COALESCE(MAX(ver), 0) FROM hsec_docs')->fetchColumn();
        foreach ($j['data'] as $coll => $rows) {
            if (!is_string($coll) || !preg_match('/^[A-Za-z]{1,40}$/', $coll) || !is_array($rows)) {
                continue;
            }
            foreach ($rows as $row) {
                $id = is_array($row) ? ($row['id'] ?? null) : null;
                if (!is_string($id) || !preg_match('/^[A-Za-z0-9_.:-]{1,100}$/', $id)) {
                    continue;
                }
                unset($row['id']);
                $json = json_encode((object) $row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $oldJson = hsec_old($db, $coll, $id);
                if ($oldJson === $json) {
                    continue;
                }
                if (strlen($json) > HSEC_MAX_DOC
                    || hsec_refusal($me, $coll, $oldJson === null ? null : json_decode($oldJson, true), $row) !== null) {
                    $kept++;
                    continue;
                }
                hsec_put($db, $me, $coll, $id, $json, $oldJson, ++$v);
                $done++;
            }
        }
        $db->exec('COMMIT');
    } catch (Throwable $ex) {
        if ($db->inTransaction()) {
            $db->exec('ROLLBACK');
        }
        throw $ex;
    }
    return ['done' => $done, 'kept' => $kept, 'at' => (string) ($j['at'] ?? '')];
}

// /erp/m/hsec opens the app full screen; admins add or replace its file and import backups with ?manage=1.
function hsec_module(bool $raw, bool $post): void
{
    $me = erp_require_user();
    $module = erp_modules()['hsec'] + ['key' => 'hsec'];
    if (!erp_can($me, 'hsec')) {
        erp_forbidden($module);
    }
    $file = hsec_file();

    if ($raw) {
        if (!is_file($file)) {
            erp_redirect('/erp/m/hsec');
        }
        $html = hsec_wording(file_get_contents($file));
        if (hsec_allowed($me) !== null) {
            // Someone limited to some companies: "All" is the total of their companies, not the whole group.
            $html = strtr($html, ['"Group – all companies (consolidated)"' => '"All my companies (consolidated)"',
                '"Group – all companies"' => '"All my companies"', '"Consolidated view, intercompany eliminated"' => '"Your companies added together"']);
        }
        $add = hsec_inject($me);
        $pos = stripos($html, '</head>');
        // The bridge must run before the app's own scripts, so it goes straight after <head>.
        $head = stripos($html, '<head>');
        $html = $head !== false ? substr_replace($html, $add, $head + 6, 0) : ($pos !== false ? substr_replace($html, $add, $pos, 0) : $add . $html);
        header('X-Frame-Options: SAMEORIGIN', true);
        header('Cache-Control: private, no-store');
        header('Content-Type: text/html; charset=utf-8');
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
    $action = $_POST['action'] ?? '';
    if ($post && in_array($action, ['clear', 'qb_check', 'qb_cancel', 'qb_import'], true)) {
        if (!$me['is_admin']) {
            erp_forbidden($module);
        }
        try {
            $done = hsec_qb_action($me, $action);
            if ($done !== null) {
                erp_flash($done);
            }
            erp_redirect('/erp/m/hsec?manage=1' . ($action === 'qb_check' ? '#qb-check' : ''));
        } catch (RuntimeException $ex) {
            $errors[] = $ex->getMessage();
        }
    } elseif ($post && in_array($action, ['app', 'import'], true)) {
        if (!$me['is_admin']) {
            erp_forbidden($module);
        }
        $field = $action === 'app' ? 'app' : 'backup';
        $up = $_FILES[$field] ?? null;
        if (!$up || $up['error'] !== UPLOAD_ERR_OK) {
            $errors[] = $up && in_array($up['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
                ? 'The file is larger than this server accepts. Put it in a .zip and upload that.'
                : ($action === 'app' ? 'Choose the HSEC file (.html or the .zip it came in).' : 'Choose the backup file (.json).');
        } else {
            try {
                if ($action === 'app') {
                    $html = erp_dashboard_html($up['tmp_name'], (string) $up['name']);
                    if (stripos($html, 'HSEC') === false) {
                        throw new RuntimeException('That does not look like the HSEC ERP file.');
                    }
                    if (!is_dir(dirname($file))) {
                        mkdir(dirname($file), 0700, true);
                    }
                    file_put_contents($file . '.new', $html);
                    rename($file . '.new', $file);
                    erp_flash('HSEC file updated.');
                } else {
                    $r = hsec_import($me, $up['tmp_name'], (string) $up['name']);
                    erp_flash('Imported ' . number_format($r['done']) . ' records' . ($r['kept'] ? ', kept ' . number_format($r['kept']) . ' posted vouchers as they are here' : '') . '.');
                }
                erp_redirect('/erp/m/hsec?manage=1');
            } catch (RuntimeException $ex) {
                $errors[] = $ex->getMessage();
            }
        }
    }
    if (!$post && is_file($file) && !isset($_GET['manage'])) {
        erp_redirect('/erp/m/hsec/app');
    }
    $check = $me['is_admin'] ? hsec_qb_unstash() : null;
    $posting = $check ? hsec_posting_accounts() : [];
    erp_render('hsec-host', ['me' => $me, 'module' => $module, 'hasFile' => is_file($file),
        'updated' => is_file($file) ? filemtime($file) : null, 'counts' => hsec_counts(), 'errors' => $errors,
        'companies' => $me['is_admin'] ? hsec_companies() : [], 'check' => $check, 'posting' => $posting,
        'suggest' => $check ? hsec_qb_suggest(array_keys($check['accounts']), $posting) : []]);
}
