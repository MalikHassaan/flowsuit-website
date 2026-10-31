<?php
// HSEC ERP access set in FlowSuit's Users and access:
//   * which menu areas (left panel) each person may open: users.hsec_mods, comma separated, empty = all;
//   * their voucher approval role: users.hsec_jv = maker | senior | gmf (empty = none);
//   * their signature image, printed on the vouchers they prepared or approved.
// With approvals switched on (ERP setting hsec_approvals), a voucher goes Maker -> Senior Manager -> Group GM Finance
// inside the system, and hsec_jv_check() makes the server hold everyone to it: only the right person can approve
// each stage, nobody approves their own voucher, and names come from the sign-in, not from what was typed.
// The HSEC app itself is not changed; a few exact string hooks (hsec_app_hooks) let it read these settings.

const HSEC_JV_ROLES = ['maker' => 'Maker', 'senior' => 'Senior Manager', 'gmf' => 'Group GM Finance'];
const HSEC_JV_STAGES = ['senior' => 'Senior Manager', 'gmf' => 'Group GM Finance'];
const HSEC_SIG_MAX = 1024 * 1024;

function hsec_access_schema(PDO $db): void
{
    $cols = array_column($db->query('PRAGMA table_info(users)')->fetchAll(), 'name');
    if (!in_array('hsec_mods', $cols, true)) {
        $db->exec("ALTER TABLE users ADD COLUMN hsec_mods TEXT NOT NULL DEFAULT ''");
    }
    if (!in_array('hsec_jv', $cols, true)) {
        $db->exec("ALTER TABLE users ADD COLUMN hsec_jv TEXT NOT NULL DEFAULT ''");
    }
    if (!in_array('hsec_title', $cols, true)) {
        $db->exec("ALTER TABLE users ADD COLUMN hsec_title TEXT NOT NULL DEFAULT ''");
    }
}

// The app's left panel: [[group, [[key, label], ...]], ...], read from the uploaded file.
function hsec_nav(): array
{
    static $nav = null;
    if ($nav !== null) {
        return $nav;
    }
    $nav = [];
    $file = hsec_file();
    if (!is_file($file)) {
        return $nav;
    }
    $cache = erp_data_dir() . '/hsec-nav.json';
    if (is_file($cache) && filemtime($cache) >= filemtime($file)) {
        $nav = json_decode((string) file_get_contents($cache), true) ?: [];
        return $nav;
    }
    $src = (string) file_get_contents($file);
    $a = strpos($src, 'const NAV = [');
    $b = $a === false ? false : strpos($src, 'const MODS = {', $a);
    if ($a !== false && $b !== false) {
        $block = substr($src, $a, $b - $a);
        if (preg_match_all('/\["([^"\[\]]+)",\s*\[((?:\["\w+","[^"]+"\],?)+)\]\]/', $block, $groups, PREG_SET_ORDER)) {
            foreach ($groups as $g) {
                preg_match_all('/\["(\w+)","([^"]+)"\]/', $g[2], $items, PREG_SET_ORDER);
                $nav[] = [$g[1], array_map(fn($i) => [$i[1], $i[2]], $items)];
            }
        }
    }
    @file_put_contents($cache, json_encode($nav));
    return $nav;
}

function hsec_nav_keys(): array
{
    $keys = [];
    foreach (hsec_nav() as [, $items]) {
        foreach ($items as [$k]) {
            $keys[] = $k;
        }
    }
    return $keys;
}

// Menu areas this person may open, or null for all of them (admins always have all).
function hsec_user_mods(array $me): ?array
{
    $mods = array_values(array_filter(explode(',', (string) ($me['hsec_mods'] ?? ''))));
    return $me['is_admin'] || !$mods ? null : $mods;
}

function hsec_approvals_on(): bool
{
    return erp_setting('hsec_approvals') === 'on';
}

// ---- Signatures: one image per person, outside the web folder ----

function hsec_sig_file(int $uid): string
{
    return erp_data_dir() . '/signatures/u' . $uid . '.png';
}

// Saves an uploaded PNG or JPEG as a PNG of at most 600 x 240 (re-drawn, so nothing but the picture is kept).
function hsec_sig_save(int $uid, array $up): void
{
    if ($up['error'] !== UPLOAD_ERR_OK || $up['size'] > HSEC_SIG_MAX) {
        throw new RuntimeException('The signature must be a picture under 1 MB.');
    }
    $info = @getimagesize($up['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_JPEG], true)) {
        throw new RuntimeException('The signature must be a PNG or JPG picture.');
    }
    if (!function_exists('imagecreatefromstring')) {
        throw new RuntimeException('This server cannot read pictures (GD is missing).');
    }
    $src = @imagecreatefromstring((string) file_get_contents($up['tmp_name']));
    if (!$src) {
        throw new RuntimeException('That picture could not be read. Try a PNG.');
    }
    [$w, $h] = [imagesx($src), imagesy($src)];
    $k = min(1, 600 / $w, 240 / $h);
    $nw = max(1, (int) round($w * $k));
    $nh = max(1, (int) round($h * $k));
    $dst = imagecreatetruecolor($nw, $nh);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 255, 255, 255, 127));
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    $dir = dirname(hsec_sig_file($uid));
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    imagepng($dst, hsec_sig_file($uid) . '.new');
    rename(hsec_sig_file($uid) . '.new', hsec_sig_file($uid));
}

// /erp/m/hsec/sig/{id}: only for people who can open HSEC.
function hsec_sig_serve(int $uid): void
{
    $me = erp_user();
    $file = hsec_sig_file($uid);
    if (!$me || !erp_can($me, 'hsec') || !is_file($file)) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: image/png');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=86400');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

// Name => picture address, for everyone with HSEC access who has a signature.
function hsec_sigs(): array
{
    $out = [];
    foreach (erp_db()->query('SELECT id, name, is_admin, active FROM users WHERE active = 1') as $u) {
        $f = hsec_sig_file((int) $u['id']);
        if (is_file($f)) {
            $out[$u['name']] = '/erp/m/hsec/sig/' . (int) $u['id'] . '?v=' . filemtime($f);
        }
    }
    return $out;
}

// Who can appear on a voucher (prepared by, approvers, posted by): name, designation, e-mail and approval role, by the
// id the server records on vouchers ('u' + user id). Printed in the voucher's sign-off table (hsec-signoff.js).
function hsec_signers(): array
{
    $out = [];
    foreach (erp_db()->query("SELECT id, name, email, hsec_jv, hsec_title FROM users WHERE active = 1 ORDER BY name") as $u) {
        $out['u' . (int) $u['id']] = ['name' => $u['name'], 'email' => $u['email'], 'title' => $u['hsec_title'],
            'role' => (string) $u['hsec_jv']];
    }
    return $out;
}

// ---- The app's settings as sent to the browser ----

// With approvals on, vouchers are approved in the system (not on paper) through Senior Manager then Group GM Finance.
function hsec_settings_override(array $data): array
{
    if (hsec_approvals_on()) {
        $data['apprScope'] = 'vouchers';
    }
    // The voucher shows the same sign-offs as Users and access, whether approval is on paper or in the system:
    // Maker (prepared by), Senior Manager, Group GM Finance (hassan, 2026-10-27).
    $data['jvChain'] = array_map(fn($role) => ['role' => $role, 'from' => ''], array_values(HSEC_JV_STAGES));
    return $data;
}

// Open browsers only fetch changed records, so switching approvals re-saves the settings record to send it again.
function hsec_touch_settings(array $me): void
{
    $db = hsec_db();
    $db->exec('BEGIN IMMEDIATE');
    $old = hsec_old($db, 'settings', 'main');
    if ($old !== null) {
        $v = (int) $db->query('SELECT COALESCE(MAX(ver), 0) + 1 FROM hsec_docs')->fetchColumn();
        hsec_put($db, $me, 'settings', 'main', $old, $old, $v);
    }
    $db->exec('COMMIT');
}

// Who holds each approval role, for the Users and access page.
function hsec_jv_people(): array
{
    $out = array_fill_keys(array_keys(HSEC_JV_ROLES), []);
    foreach (erp_db()->query("SELECT id, name, hsec_jv FROM users WHERE active = 1 AND hsec_jv <> '' ORDER BY name") as $u) {
        if (isset($out[$u['hsec_jv']])) {
            $out[$u['hsec_jv']][] = ['name' => $u['name'], 'sig' => is_file(hsec_sig_file((int) $u['id']))];
        }
    }
    return $out;
}

// ---- The server's rules for vouchers while approvals are on ----

// Why a voucher change is refused, or null. May fill in names, ids and times on $new.
function hsec_jv_check(array $me, ?array $old, ?array &$new): ?string
{
    if (!hsec_approvals_on()) {
        return null;
    }
    $role = (string) ($me['hsec_jv'] ?? '');
    // Once a voucher has been sent for approval, only these two may change, cancel or reverse it (hassan, 2026-10-25),
    // and an ERP admin, who may do everything (hassan, 2026-10-30).
    $admin = (bool) $me['is_admin'];
    $senior = in_array($role, ['senior', 'gmf'], true) || $admin;
    $deny = 'Only the Senior Manager or the Group GM Finance can change, cancel or reverse a voucher once it has been sent for approval.';
    $wasSent = in_array((string) ($old['status'] ?? ''), ['Pending approval', 'Approved', 'Rejected'], true) && !empty($old['maker']);
    if ($new === null) {
        return $wasSent && !$senior ? $deny : null;
    }
    if (!$senior && (($old === null && !empty($new['reversalOf'])) || ($new['reversedBy'] ?? null) !== ($old['reversedBy'] ?? null))) {
        return 'Only the Senior Manager or the Group GM Finance can reverse a voucher.';
    }
    $uid = 'u' . $me['id'];
    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $oldSt = (string) ($old['status'] ?? '');
    $newSt = (string) ($new['status'] ?? '');
    $oldAp = is_array($old['approvals'] ?? null) ? $old['approvals'] : [];
    $newAp = is_array($new['approvals'] ?? null) ? $new['approvals'] : [];
    $fromDoc = !empty($new['source']) || !empty($new['reversalOf']);
    $sameMaker = fn(array $mk) => ($mk['uid'] ?? '') === $uid || strcasecmp((string) ($mk['name'] ?? ''), $me['name']) === 0;

    // Submitted (or sent again after being returned).
    $submitted = $newSt === 'Pending approval' && $oldSt !== 'Pending approval';
    if ($submitted) {
        if (!$fromDoc && $role !== 'maker' && !$me['is_admin']) {
            return 'Only a person with the Maker approval role can submit a voucher for approval. Ask your admin to give you that role.';
        }
        if ($newAp) {
            return 'A voucher sent for approval starts with no approvals.';
        }
        $new['maker'] = ['name' => $me['name'], 'uid' => $uid, 'at' => $now];
        return null;
    }

    // Approvals already given stay exactly as the server recorded them. The browser's copy may not have the
    // server's names and times yet, so entries are matched on stage and decision, then the recorded ones kept.
    foreach ($oldAp as $i => $a) {
        $b = $newAp[$i] ?? null;
        if (!is_array($b) || ($b['stage'] ?? '') !== ($a['stage'] ?? '') || ($b['action'] ?? '') !== ($a['action'] ?? '')) {
            return 'Approvals already given on a voucher cannot be changed or removed.';
        }
        $newAp[$i] = $a;
    }
    if (is_array($old['maker'] ?? null)) {
        $new['maker'] = $old['maker'];
    }
    // A voucher sent for approval can be changed only by the Senior Manager or the Group GM Finance.
    if (!$senior && in_array($oldSt, ['Pending approval', 'Approved'], true)) {
        foreach (['lines', 'date', 'entity', 'narration', 'payee', 'dept', 'vtype', 'chequeNo', 'chequeDate', 'costCentre'] as $k) {
            if (($new[$k] ?? null) != ($old[$k] ?? null)) {
                return $deny;
            }
        }
    }
    $maker = is_array($new['maker'] ?? null) ? $new['maker'] : [];
    $given = [];
    foreach ($oldAp as $a) {
        if (($a['action'] ?? '') === 'Approved') {
            $given[$a['stage'] ?? ''] = $a['uid'] ?? strtolower((string) ($a['name'] ?? ''));
        }
    }
    foreach (array_slice($newAp, count($oldAp), null, true) as $i => $a) {
        $stage = (string) ($a['stage'] ?? '');
        $need = array_search($stage, HSEC_JV_STAGES, true);
        if ($need === false) {
            return 'Vouchers are approved by ' . implode(' then ', HSEC_JV_STAGES) . '. Reload the page and try again.';
        }
        if ($oldSt !== 'Pending approval') {
            return 'This voucher is not waiting for approval.';
        }
        // an admin may approve every stage alone, even their own voucher (hassan, 2026-10-30)
        if ($role !== $need && !$admin) {
            return 'Only a ' . $stage . ' can approve or return a voucher at this stage. Your approval role: '
                . (HSEC_JV_ROLES[$role] ?? 'none') . '.';
        }
        if ($maker && $sameMaker($maker) && !$admin) {
            return 'You prepared this voucher, so you cannot approve it.';
        }
        if (in_array($uid, $given, true) && !$admin) {
            return 'You have already approved this voucher at an earlier stage.';
        }
        if ($need === 'gmf' && !isset($given[HSEC_JV_STAGES['senior']]) && !$admin) {
            return 'The Senior Manager approves first.';
        }
        $newAp[$i] = ['stage' => $stage, 'name' => $me['name'], 'uid' => $uid, 'action' => ($a['action'] ?? '') === 'Approved' ? 'Approved' : 'Rejected',
            'at' => $now, 'comment' => mb_substr((string) ($a['comment'] ?? ''), 0, 500)];
        if ($newAp[$i]['action'] === 'Approved') {
            $given[$stage] = $uid;
        }
    }
    $new['approvals'] = $newAp;
    $complete = count(array_intersect(array_values(HSEC_JV_STAGES), array_keys($given))) === count(HSEC_JV_STAGES);
    if ($newSt === 'Approved' && $oldSt !== 'Approved' && !$complete) {
        return 'A voucher is approved only after the Senior Manager and the Group GM Finance have both approved it.';
    }
    // The last approval posts the voucher; there is no separate Post step (hassan, 2026-10-30).
    $justApproved = $complete && $oldSt === 'Pending approval' && in_array($newSt, ['Approved', 'Posted'], true) && count($newAp) > count($oldAp);
    if ($justApproved) {
        $new['status'] = $newSt = 'Posted';
        $new['postedBy'] = ['name' => $me['name'], 'uid' => $uid, 'at' => $now, 'auto' => true];
        return null;
    }
    if ($newSt === 'Posted' && $oldSt !== 'Posted' && !$fromDoc && $old !== null && $oldSt !== 'Approved' && !$admin) {
        return 'This voucher has to be approved by the Senior Manager and the Group GM Finance before it is posted.';
    }
    return null;
}

// ---- Hooks into the app, so its own menu and role checks use FlowSuit's settings ----

const HSEC_HOOKS = [
    'const secOn = () => Store.mode === "shared" && settings().security === "On";'
        => 'const secOn = () => Store.mode === "shared" && (settings().security === "On" || !!window.FS_MODS);',
    'const ROLE = Object.fromEntries(ROLES.map(r => [r.k, r]));'
        => 'const ROLE = Object.fromEntries(ROLES.map(r => [r.k, r])); if (window.FS_MODS) ROLE.fs = {k:"fs", name:"FlowSuit ERP access", mods:window.FS_MODS, ro:!window.FS_BRIDGE.edit, desc:"Set in FlowSuit ERP, Users and access"};',
    'function myRoles(){ const s = new Set(); if (ME.owner) s.add("admin");'
        => 'function myRoles(){ if (window.FS_MODS) return new Set(["fs"]); const s = new Set(); if (ME.owner) s.add("admin");',
    'const JV_POSTERS = ["admin","gmf"];'
        => 'const JV_POSTERS = ["admin","gmf"].concat(window.FS_JV === "gmf" ? ["fs"] : []);',
];

// An admin may approve every stage alone, even their own voucher, and post one still waiting for approval; the last
// approval posts the voucher at once (hassan, 2026-10-30).
const HSEC_ADMIN_HOOKS = [
    'if (nx && r.maker && r.maker.name.toLowerCase() === name.toLowerCase()){'
        => 'if (nx && !window.FS_ADMIN && r.maker && r.maker.name.toLowerCase() === name.toLowerCase()){',
    'if (nx && (r.approvals||[]).some(a => a.action === "Approved" && a.name.toLowerCase() === name.toLowerCase())){'
        => 'if (nx && !window.FS_ADMIN && (r.approvals||[]).some(a => a.action === "Approved" && a.name.toLowerCase() === name.toLowerCase())){',
    'if (t.id === "jvReject") r.status = "Rejected"; else if (!jvNext(r)) r.status = "Approved"; }'
        => 'if (t.id === "jvReject") r.status = "Rejected"; else if (!jvNext(r)){ r.status = "Posted"; r.postedBy = {name, at:now, auto:true}; } }',
    '"Fully approved – ready to post"' => '"Approved and posted to the ledger"',
    'if (st === "Approved") extra = `<button type="button" class="btn" id="jvPost">Post</button>`;'
        => 'if (st === "Approved") extra = `<button type="button" class="btn" id="jvPost">Post</button>`; if (window.FS_ADMIN && st === "Pending approval") extra += `<button type="button" class="btn" id="jvPost">Post now (admin)</button>`;',
];

// Applies the hooks only if every one of them matches exactly once (a new app version may have changed them).
function hsec_app_hooks(string $html): string
{
    foreach (array_keys(HSEC_HOOKS) as $find) {
        if (substr_count($html, $find) !== 1) {
            @file_put_contents(erp_data_dir() . '/erp-errors.log', '[' . date('Y-m-d H:i:s') . '] hsec hooks: not found: ' . substr($find, 0, 60) . "\n", FILE_APPEND);
            return $html;
        }
    }
    $html = strtr($html, HSEC_HOOKS);
    // Optional ones, each applied only where it still matches, so a new app version loses only that one.
    foreach (HSEC_ADMIN_HOOKS as $find => $put) {
        if (substr_count($html, $find) === 1) {
            $html = str_replace($find, $put, $html);
        }
    }
    return $html;
}

// Settings for the page: menu areas, approval role, signatures, and the signed-in name for every "your name" box.
function hsec_access_inject(array $me): string
{
    $flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES;
    $mods = hsec_user_mods($me);
    $cfg = ['jv' => (string) ($me['hsec_jv'] ?? ''), 'admin' => (bool) $me['is_admin'], 'on' => hsec_approvals_on(), 'sigs' => hsec_sigs(),
        'me' => 'u' . (int) $me['id'], 'people' => hsec_signers()];
    return '<script>' . ($mods !== null ? 'window.FS_MODS=' . json_encode($mods, $flags) . ';' : '')
        . 'window.FS_JV=' . json_encode($cfg['jv']) . ';window.FS_ADMIN=' . ($cfg['admin'] ? 'true' : 'false') . ';window.FS_SIGN=' . json_encode($cfg, $flags) . ';'
        // Tabs signed in to different accounts share this browser's storage, so each tab writes its own name back
        // whenever it is used, for the app's "your name" boxes.
        . '(function(){var n=' . json_encode($me['name'], $flags) . ',w=function(){try{localStorage.setItem("hsec-erp-name",n);}catch(e){}};w();'
        . 'addEventListener("focus",w);addEventListener("pointerdown",w,true);addEventListener("keydown",w,true);})();</script>'
        . '<style>' . file_get_contents(__DIR__ . '/hsec-sign.css') . '</style><script>' . file_get_contents(__DIR__ . '/hsec-sign.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-projpl.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-bgsec.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-ux.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-ic.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-terms.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-paysched.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-projimport.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-advbg.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-qbproj.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-basis.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-ifrs15.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-signoff.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-vlink.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-home.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-petty.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-accpick.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-acctnew.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-att.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-undo.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-demand.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-company.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-brec.js') . '</script>'
        . '<script>' . file_get_contents(__DIR__ . '/hsec-rvcust.js') . '</script>';
}
