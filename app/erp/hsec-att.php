<?php
declare(strict_types=1);

// Supporting documents on HSEC vouchers and records (hassan, 2026-10-30: "add attachment option ... save the files on
// the server ... in KB not MB ... on each voucher there should be an eye option where we can see the voucher along with
// the supporting documents"). Photos are shrunk in the browser before they are sent (hsec-att.js), so a receipt is
// usually 100-300 KB; PDFs are kept as they are, up to HSEC_ATT_MAX. Files sit in flowsuit-data/hsec-att (outside
// public_html, in the backup) and are only served to people who can see the record they belong to. Removing a file
// only hides it, so the record of who attached what stays.

const HSEC_ATT_MAX = 2 * 1024 * 1024; // bytes
const HSEC_ATT_PER_DOC = 20;
const HSEC_ATT_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];

function hsec_att_dir(): string
{
    $dir = erp_data_dir() . '/hsec-att';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    return $dir;
}

function hsec_att_db(): PDO
{
    $db = hsec_db();
    $db->exec('CREATE TABLE IF NOT EXISTS hsec_atts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, coll TEXT NOT NULL, doc_id TEXT NOT NULL, name TEXT NOT NULL,
        mime TEXT NOT NULL, size INTEGER NOT NULL, stored TEXT NOT NULL, by_user INTEGER, at TEXT NOT NULL,
        deleted_by INTEGER, deleted_at TEXT)');
    $db->exec('CREATE INDEX IF NOT EXISTS hsec_atts_doc ON hsec_atts (coll, doc_id)');
    return $db;
}

// The record must exist and belong to a company this person may see.
function hsec_att_doc_ok(array $me, string $coll, string $id): bool
{
    $st = hsec_db()->prepare('SELECT data FROM hsec_docs WHERE coll = ? AND id = ? AND data IS NOT NULL');
    $st->execute([$coll, $id]);
    $json = $st->fetchColumn();
    return $json !== false && hsec_visible(hsec_allowed($me), json_decode((string) $json, true));
}

function hsec_att_key(string $key): ?array
{
    return preg_match('#^([A-Za-z]{1,40})/([A-Za-z0-9_.:-]{1,100})$#', $key, $m) ? [$m[1], $m[2]] : null;
}

function hsec_att_out(array $r): array
{
    return ['id' => (int) $r['id'], 'key' => $r['coll'] . '/' . $r['doc_id'], 'name' => $r['name'], 'mime' => $r['mime'],
        'size' => (int) $r['size'], 'by' => $r['by_name'] ?? '', 'uid' => (int) $r['by_user'], 'at' => $r['at']];
}

function hsec_att_api(array $me, string $sub, string $method): void
{
    $db = hsec_att_db();
    $sel = 'SELECT a.*, u.name AS by_name FROM hsec_atts a LEFT JOIN users u ON u.id = a.by_user WHERE a.deleted_at IS NULL';

    if ($sub === '/index' && $method === 'GET') {
        // How many files each record has, for the paperclip counts.
        $allowed = hsec_allowed($me);
        $rows = $db->query('SELECT a.coll, a.doc_id, COUNT(*) AS n, d.data FROM hsec_atts a JOIN hsec_docs d ON d.coll = a.coll AND d.id = a.doc_id
            WHERE a.deleted_at IS NULL AND d.data IS NOT NULL GROUP BY a.coll, a.doc_id')->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            if ($allowed === null || hsec_visible($allowed, json_decode((string) $r['data'], true))) {
                $out[$r['coll'] . '/' . $r['doc_id']] = (int) $r['n'];
            }
        }
        taj_json(['counts' => (object) $out]);
    }

    if ($sub === '' && $method === 'GET') {
        $files = [];
        foreach (array_slice(array_unique(explode(',', (string) ($_GET['keys'] ?? ''))), 0, 20) as $key) {
            $k = hsec_att_key($key);
            if (!$k || !hsec_att_doc_ok($me, $k[0], $k[1])) {
                continue;
            }
            $st = $db->prepare($sel . ' AND a.coll = ? AND a.doc_id = ? ORDER BY a.id');
            $st->execute($k);
            foreach ($st->fetchAll() as $r) {
                $files[] = hsec_att_out($r);
            }
        }
        taj_json(['files' => $files]);
    }

    if ($sub === '/file' && $method === 'GET') {
        $st = $db->prepare($sel . ' AND a.id = ?');
        $st->execute([(int) ($_GET['id'] ?? 0)]);
        $r = $st->fetch();
        $path = $r ? hsec_att_dir() . '/' . $r['stored'] : '';
        if (!$r || !hsec_att_doc_ok($me, $r['coll'], $r['doc_id']) || !is_file($path)) {
            taj_fail(404, 'not_found', 'File not found');
        }
        session_write_close();
        $dl = !empty($_GET['dl']);
        header('Content-Type: ' . $r['mime']);
        header('X-Content-Type-Options: nosniff');
        // A sandboxed frame stops the browser's PDF viewer, so only photos get the sandbox.
        if ($r['mime'] !== 'application/pdf') {
            header("Content-Security-Policy: default-src 'none'; sandbox");
        }
        header('Content-Disposition: ' . ($dl ? 'attachment' : 'inline') . "; filename*=UTF-8''" . rawurlencode($r['name']));
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, max-age=604800, immutable');
        readfile($path);
        exit;
    }

    if (!erp_can($me, 'hsec', 'edit')) {
        taj_fail(403, 'permission_denied', 'You have view-only access, so you cannot add or remove files');
    }

    if ($sub === '' && $method === 'POST') {
        $k = hsec_att_key((string) ($_POST['path'] ?? ''));
        if (!$k || !hsec_att_doc_ok($me, $k[0], $k[1])) {
            taj_fail(404, 'not_found', 'Save the record first, then attach the file');
        }
        $f = $_FILES['file'] ?? null;
        if (!$f || $f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE || $f['size'] > HSEC_ATT_MAX) {
            taj_fail(400, 'resource_exhausted', 'That file is over ' . (HSEC_ATT_MAX >> 20) . ' MB. Scan it at a lower quality or take a photo instead.');
        }
        if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
            taj_fail(400, 'invalid_argument', 'The file did not upload. Try again.');
        }
        $head = (string) file_get_contents($f['tmp_name'], false, null, 0, 16);
        $mime = str_starts_with($head, '%PDF-') ? 'application/pdf' : (string) (@getimagesize($f['tmp_name'])['mime'] ?? '');
        if (!isset(HSEC_ATT_TYPES[$mime])) {
            taj_fail(400, 'invalid_argument', 'Only photos (JPG, PNG, WebP) and PDF files can be attached.');
        }
        $st = $db->prepare('SELECT COUNT(*) FROM hsec_atts WHERE coll = ? AND doc_id = ? AND deleted_at IS NULL');
        $st->execute($k);
        if ((int) $st->fetchColumn() >= HSEC_ATT_PER_DOC) {
            taj_fail(400, 'resource_exhausted', 'This record already has ' . HSEC_ATT_PER_DOC . ' files. Remove one first.');
        }
        $base = pathinfo(preg_replace('/[\x00-\x1f"\\\\\/<>]/u', '', basename((string) ($_POST['name'] ?? $f['name']))) ?: 'file', PATHINFO_FILENAME);
        $name = mb_substr($base ?: 'file', 0, 100) . '.' . HSEC_ATT_TYPES[$mime];
        $stored = bin2hex(random_bytes(16)) . '.' . HSEC_ATT_TYPES[$mime];
        if (!move_uploaded_file($f['tmp_name'], hsec_att_dir() . '/' . $stored)) {
            taj_fail(500, 'internal', 'The server could not save the file.');
        }
        $db->prepare('INSERT INTO hsec_atts (coll, doc_id, name, mime, size, stored, by_user, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$k[0], $k[1], $name, $mime, (int) $f['size'], $stored, (int) $me['id'], erp_now()]);
        $st = $db->prepare($sel . ' AND a.id = ?');
        $st->execute([(int) $db->lastInsertId()]);
        taj_json(['file' => hsec_att_out($st->fetch())]);
    }

    if ($sub === '/move' && $method === 'POST') {
        // A record about to be deleted after its vouchers were reversed hands its files to its old voucher.
        $from = hsec_att_key((string) ($_POST['from'] ?? ''));
        $to = hsec_att_key((string) ($_POST['to'] ?? ''));
        if (!$from || !$to || !hsec_att_doc_ok($me, $from[0], $from[1]) || !hsec_att_doc_ok($me, $to[0], $to[1])) {
            taj_fail(404, 'not_found', 'Record not found');
        }
        $db->prepare('UPDATE hsec_atts SET coll = ?, doc_id = ? WHERE coll = ? AND doc_id = ? AND deleted_at IS NULL')
            ->execute([$to[0], $to[1], $from[0], $from[1]]);
        taj_json(['ok' => true]);
    }

    if ($sub === '/delete' && $method === 'POST') {
        $st = $db->prepare($sel . ' AND a.id = ?');
        $st->execute([(int) ($_POST['id'] ?? 0)]);
        $r = $st->fetch();
        if (!$r || !hsec_att_doc_ok($me, $r['coll'], $r['doc_id'])) {
            taj_fail(404, 'not_found', 'File not found');
        }
        if (!$me['is_admin'] && (int) $r['by_user'] !== (int) $me['id']) {
            taj_fail(403, 'permission_denied', 'Only the person who attached it, or an admin, can remove this file');
        }
        $db->prepare('UPDATE hsec_atts SET deleted_by = ?, deleted_at = ? WHERE id = ?')->execute([(int) $me['id'], erp_now(), (int) $r['id']]);
        taj_json(['ok' => true]);
    }

    taj_fail(404, 'not_found', 'Unknown request');
}
