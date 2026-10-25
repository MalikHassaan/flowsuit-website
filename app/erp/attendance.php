<?php
// Attendance: staff check in and out from any ERP page (att.js), HR sees the team and the month sheet.
//   In the office: the check-in comes from one of the office internet addresses (Settings), nothing else needed.
//   Anywhere else (site engineers): the exact location is required. Every check-in saves the location (when the
//   device allows it) and the IP address; it is tagged with the nearest saved site, or flagged "Not at a known site".
// Times always come from the server clock. At the end of the day anyone still checked in gets a reminder in
// the ERP and by e-mail (att_reminders()).

const ATT_PHOTO_MAX = 3 * 1024 * 1024;
const ATT_STATUS = [
    'present' => ['P', 'Present'], 'late' => ['L', 'Late'], 'half' => ['H', 'Half day'], 'missed' => ['M', 'Missed checkout'],
    'absent' => ['A', 'Absent'], 'leave' => ['LV', 'Leave'], 'off' => ['O', 'Weekly off'], 'holiday' => ['HO', 'Holiday'],
    'in' => ['IN', 'Checked in'], 'pending' => ['-', 'Not in yet'], 'none' => ['', ''],
];
const ATT_LEAVE_TYPES = ['annual' => 'Annual leave', 'sick' => 'Sick leave', 'casual' => 'Casual leave', 'unpaid' => 'Unpaid leave'];

function att_schema(PDO $db): void
{
    $db->exec('CREATE TABLE IF NOT EXISTS att_punches (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, day TEXT NOT NULL, at TEXT NOT NULL,
        method TEXT NOT NULL, ip TEXT, lat REAL, lng REAL, acc REAL, site TEXT, site_dist INTEGER, photo TEXT, note TEXT, by_user INTEGER)');
    $db->exec('CREATE INDEX IF NOT EXISTS att_punches_day ON att_punches (day, user_id)');
    $db->exec('CREATE TABLE IF NOT EXISTS att_sites (id INTEGER PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, radius INTEGER NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS att_requests (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL, day_from TEXT NOT NULL, day_to TEXT NOT NULL,
        in_time TEXT, out_time TEXT, leave_type TEXT, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'pending\',
        decided_by INTEGER, decided_at TEXT, created_at TEXT NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS att_sent (user_id INTEGER NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY (user_id, day, kind))');
}

function att_cfg(): array
{
    if (erp_setting('att_since') === null) {
        erp_setting_set('att_since', date('Y-m-d'));
    }
    static $cfg = null;
    return $cfg ??= [
        'start' => erp_setting('att_start') ?? '10:00',
        'grace' => (int) (erp_setting('att_grace') ?? 15),
        'end' => erp_setting('att_end') ?? '18:00',
        'cutoff' => erp_setting('att_cutoff') ?? '20:00',
        'half' => (float) (erp_setting('att_half') ?? 4),
        'off' => array_map('intval', array_filter(explode(',', erp_setting('att_off') ?? '0'), 'strlen')),
        'holidays' => att_holidays(erp_setting('att_holidays') ?? ''),
        'since' => erp_setting('att_since') ?? date('Y-m-d'),
        'ips' => array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', erp_setting('att_ips') ?? '')))),
    ];
}

// "2026-12-25 Christmas" lines -> ['2026-12-25' => 'Christmas'].
function att_holidays(string $text): array
{
    $out = [];
    foreach (preg_split('/\R/', $text) as $line) {
        if (preg_match('/^\s*(\d{4}-\d{2}-\d{2})\s*(.*)$/', $line, $m)) {
            $out[$m[1]] = trim($m[2]) ?: 'Holiday';
        }
    }
    return $out;
}

// HR level: 'edit' manages the team, 'view' sees it, '' only their own attendance.
function att_hr(array $me): string
{
    return $me['is_admin'] ? 'edit' : (string) ($me['access']['attendance'] ?? '');
}

// Office addresses: exact IPv4 ("203.0.113.7"), a range ("203.0.113.0/24") or an IPv6 network ("2400:adc5:1:2::/64").
function att_ip_match(string $ip, array $list): bool
{
    $bin = @inet_pton($ip);
    if ($bin === false) {
        return false;
    }
    foreach ($list as $entry) {
        [$net, $bits] = array_pad(explode('/', $entry, 2), 2, null);
        $nb = @inet_pton($net);
        if ($nb === false || strlen($nb) !== strlen($bin)) {
            continue;
        }
        $bits = $bits === null ? strlen($bin) * 8 : max(0, min(strlen($bin) * 8, (int) $bits));
        $bytes = intdiv($bits, 8);
        if (substr($bin, 0, $bytes) !== substr($nb, 0, $bytes)) {
            continue;
        }
        $rest = $bits % 8;
        if ($rest && ((ord($bin[$bytes]) ^ ord($nb[$bytes])) & (0xFF << (8 - $rest)) & 0xFF)) {
            continue;
        }
        return true;
    }
    return false;
}

// The entry to add for the address someone is on now: IPv6 phones change their last half, so take the /64.
function att_ip_entry(string $ip): string
{
    if (str_contains($ip, ':') && ($b = @inet_pton($ip)) !== false) {
        return inet_ntop(substr($b, 0, 8) . str_repeat("\0", 8)) . '/64';
    }
    return $ip;
}

function att_distance(float $lat1, float $lng1, float $lat2, float $lng2): int
{
    $r = 6371000;
    $p1 = deg2rad($lat1);
    $p2 = deg2rad($lat2);
    $a = sin(($p2 - $p1) / 2) ** 2 + cos($p1) * cos($p2) * sin(deg2rad($lng2 - $lng1) / 2) ** 2;
    return (int) round(2 * $r * asin(min(1, sqrt($a))));
}

function att_photos_dir(): string
{
    $dir = erp_data_dir() . '/att-photos';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    return $dir;
}

function att_punches_today(int $uid): array
{
    $st = erp_db()->prepare('SELECT * FROM att_punches WHERE user_id = ? AND day = ? ORDER BY at, id');
    $st->execute([$uid, date('Y-m-d')]);
    return $st->fetchAll();
}

function att_workday(string $day): bool
{
    $c = att_cfg();
    return !in_array((int) date('w', strtotime($day)), $c['off'], true) && !isset($c['holidays'][$day]);
}

function att_inject(array $me): string
{
    $flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES;
    $cfg = ['api' => '/erp/attendance/api', 'csrf' => $_SESSION['csrf'], 'page' => '/erp/m/attendance'];
    return '<style>' . file_get_contents(__DIR__ . '/att.css') . '</style><script>window.FS_ATT=' . json_encode($cfg, $flags) . ";\n"
        . file_get_contents(__DIR__ . '/att.js') . '</script>';
}

function att_state(array $me): array
{
    $c = att_cfg();
    $p = att_punches_today((int) $me['id']);
    $last = end($p) ?: null;
    return ['office' => att_ip_match(erp_ip(), $c['ips']), 'state' => $last ? $last['kind'] : 'none',
        'punches' => array_map(fn($r) => ['kind' => $r['kind'], 'at' => substr($r['at'], 11, 5), 'method' => $r['method'], 'site' => $r['site']], $p),
        'end' => $c['end'], 'now' => time(), 'workday' => att_workday(date('Y-m-d'))];
}

function att_api(string $sub): void
{
    $me = erp_user();
    if (!$me || $me['must_change']) {
        chat_json(['error' => 'Signed out'], 401);
    }
    session_write_close();
    $uid = (int) $me['id'];
    $db = erp_db();

    if ($sub === '/state') {
        att_reminders_maybe();
        chat_json(att_state($me));
    }
    if (preg_match('#^/photo/(\d+)$#', $sub, $m)) {
        $st = $db->prepare('SELECT user_id, photo FROM att_punches WHERE id = ?');
        $st->execute([(int) $m[1]]);
        $r = $st->fetch();
        if (!$r || !$r['photo'] || ((int) $r['user_id'] !== $uid && att_hr($me) === '') || !is_file($path = att_photos_dir() . '/' . $r['photo'])) {
            chat_json(['error' => 'Not found'], 404);
        }
        header('Content-Type: image/jpeg');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=86400');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        chat_json(['error' => 'Not found'], 404);
    }

    if ($sub === '/check') {
        $kind = ($_POST['kind'] ?? '') === 'out' ? 'out' : 'in';
        $p = att_punches_today($uid);
        $state = $p ? end($p)['kind'] : 'none';
        if ($kind === 'in' && $state === 'in') {
            chat_json(['error' => 'You are already checked in.'], 400);
        }
        if ($kind === 'out' && $state !== 'in') {
            chat_json(['error' => 'You are not checked in.'], 400);
        }
        $c = att_cfg();
        $office = att_ip_match(erp_ip(), $c['ips']);
        $lat = is_numeric($_POST['lat'] ?? null) ? (float) $_POST['lat'] : null;
        $lng = is_numeric($_POST['lng'] ?? null) ? (float) $_POST['lng'] : null;
        $acc = is_numeric($_POST['acc'] ?? null) ? (float) $_POST['acc'] : null;
        if ($lat !== null && (abs($lat) > 90 || abs($lng) > 180)) {
            $lat = $lng = null;
        }
        $photo = null;
        $f = $_FILES['photo'] ?? null;
        if ($f && $f['error'] === UPLOAD_ERR_OK && is_uploaded_file($f['tmp_name']) && $f['size'] <= ATT_PHOTO_MAX) {
            $info = @getimagesize($f['tmp_name']);
            if ($info && $info[2] === IMAGETYPE_JPEG) {
                $photo = bin2hex(random_bytes(16)) . '.jpg';
                move_uploaded_file($f['tmp_name'], att_photos_dir() . '/' . $photo) || $photo = null;
            }
        }
        if (!$office && ($lat === null || $lng === null)) {
            chat_json(['error' => 'You are not on the office internet, so your location is needed. Allow location for this site and try again.'], 400);
        }
        $site = null;
        $dist = null;
        if ($lat !== null) {
            foreach ($db->query('SELECT * FROM att_sites')->fetchAll() as $s) {
                $d = att_distance($lat, $lng, (float) $s['lat'], (float) $s['lng']);
                if ($dist === null || $d - (int) $s['radius'] < $dist) {
                    $dist = $d - (int) $s['radius'];
                    $site = $d <= (int) $s['radius'] ? $s['name'] : null;
                }
            }
            $dist = $dist === null ? null : max(0, $dist);
        }
        $auto = ($_POST['auto'] ?? '') === '1';
        $db->prepare('INSERT INTO att_punches (user_id, kind, day, at, method, ip, lat, lng, acc, site, site_dist, photo, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$uid, $kind, date('Y-m-d'), erp_now(), $office ? 'office' : 'remote', erp_ip(), $lat, $lng, $acc, $site, $dist, $photo, $auto ? 'Checked in on opening the ERP' : null]);
        if ($kind === 'in' && !$p) {
            att_tell($uid, att_first_in_message($office, $site));
        }
        chat_json(att_state($me) + ['done' => $kind]);
    }

    chat_json(['error' => 'Not found'], 404);
}

// The day's first check-in: on time or late, said in the person's "Attendance" chat.
function att_first_in_message(bool $office, ?string $site): string
{
    $c = att_cfg();
    $lateAfter = date('H:i', strtotime($c['start']) + $c['grace'] * 60);
    $now = date('H:i');
    $where = $office ? 'from the office' : ($site ? 'at ' . $site : 'away from the office and every saved site');
    if (!att_workday(date('Y-m-d'))) {
        return 'Your attendance was marked at ' . date('g:i a') . ' ' . $where . '. Today is a day off.';
    }
    return $now > $lateAfter
        ? 'Your attendance was marked LATE at ' . date('g:i a') . ' ' . $where . '. The day starts at ' . date('g:i a', strtotime($c['start'])) . ' and counts as late after ' . date('g:i a', strtotime($lateAfter)) . '. If this is wrong, ask for a correction under Attendance.'
        : 'Your attendance was marked present at ' . date('g:i a') . ' ' . $where . '. Have a good day.';
}

// A message from "FlowSuit ERP" in the person's own Attendance chat (one per person, read-only for them).
function att_tell(int $uid, string $text): void
{
    $db = erp_db();
    $key = 'sys-att-' . $uid;
    $st = $db->prepare('SELECT id FROM chat_rooms WHERE dm_key = ?');
    $st->execute([$key]);
    $room = (int) $st->fetchColumn();
    if (!$room) {
        $db->prepare("INSERT INTO chat_rooms (kind, name, dm_key, created_by, created_at) VALUES ('system', 'Attendance', ?, 0, ?)")->execute([$key, erp_now()]);
        $room = (int) $db->lastInsertId();
        $db->prepare('INSERT INTO chat_members (room_id, user_id) VALUES (?, ?)')->execute([$room, $uid]);
    }
    $db->prepare('INSERT INTO chat_messages (room_id, user_id, body, created_at) VALUES (?, 0, ?, ?)')->execute([$room, $text, erp_now()]);
}

// ---- Day status ----

// Per user, per day: status, first in, last out, hours worked and flags, for the days in [$from, $to].
function att_days(array $users, string $from, string $to): array
{
    $c = att_cfg();
    $db = erp_db();
    $ids = array_map(fn($u) => (int) $u['id'], $users);
    $out = [];
    if (!$ids) {
        return $out;
    }
    $in = implode(',', $ids);
    $punches = [];
    $st = $db->prepare("SELECT * FROM att_punches WHERE user_id IN ($in) AND day BETWEEN ? AND ? ORDER BY at, id");
    $st->execute([$from, $to]);
    foreach ($st->fetchAll() as $p) {
        $punches[$p['user_id']][$p['day']][] = $p;
    }
    $leaves = [];
    $st = $db->prepare("SELECT * FROM att_requests WHERE type = 'leave' AND status = 'approved' AND user_id IN ($in) AND day_to >= ? AND day_from <= ?");
    $st->execute([$from, $to]);
    foreach ($st->fetchAll() as $l) {
        $leaves[$l['user_id']][] = $l;
    }
    $today = date('Y-m-d');
    $nowHm = date('H:i');
    $lateAfter = date('H:i', strtotime($c['start']) + $c['grace'] * 60);
    foreach ($users as $u) {
        $uid = (int) $u['id'];
        $joined = max(substr((string) $u['created_at'], 0, 10), $c['since']); // nobody is absent before attendance started
        for ($d = $from; $d <= $to; $d = date('Y-m-d', strtotime($d . ' +1 day'))) {
            $p = $punches[$uid][$d] ?? [];
            $row = ['status' => 'none', 'in' => null, 'out' => null, 'hours' => 0.0, 'late' => false, 'offsite' => false, 'punches' => $p, 'note' => ''];
            if ($p) {
                $row['in'] = substr($p[0]['at'], 11, 5);
                $open = null;
                foreach ($p as $x) {
                    if ($x['kind'] === 'in') {
                        $open ??= strtotime($x['at']);
                    } elseif ($open !== null) {
                        $row['hours'] += (strtotime($x['at']) - $open) / 3600;
                        $open = null;
                        $row['out'] = substr($x['at'], 11, 5);
                    }
                    if ($x['method'] === 'remote' && !$x['site']) {
                        $row['offsite'] = true;
                    }
                }
                $row['late'] = $row['in'] > $lateAfter && att_workday($d);
                if ($open !== null) {
                    $row['status'] = $d < $today || $nowHm >= $c['cutoff'] ? 'missed' : 'in';
                    $row['out'] = null;
                } else {
                    $row['status'] = $row['hours'] < $c['half'] ? 'half' : ($row['late'] ? 'late' : 'present');
                }
            } elseif ($d > $today || $d < $joined) {
                $row['status'] = 'none';
            } elseif (isset($c['holidays'][$d])) {
                $row['status'] = 'holiday';
                $row['note'] = $c['holidays'][$d];
            } elseif (in_array((int) date('w', strtotime($d)), $c['off'], true)) {
                $row['status'] = 'off';
            } else {
                $row['status'] = $d === $today && $nowHm < $c['end'] ? 'pending' : 'absent';
            }
            foreach ($leaves[$uid] ?? [] as $l) {
                if ($d >= $l['day_from'] && $d <= $l['day_to'] && $d >= $joined && in_array($row['status'], ['absent', 'pending', 'none'], true)) {
                    $row['status'] = 'leave';
                    $row['note'] = ATT_LEAVE_TYPES[$l['leave_type']] ?? 'Leave';
                }
            }
            $out[$uid][$d] = $row;
        }
    }
    return $out;
}

function att_totals(array $days): array
{
    $t = ['present' => 0, 'late' => 0, 'half' => 0, 'absent' => 0, 'leave' => 0, 'missed' => 0, 'off' => 0, 'offsite' => 0, 'hours' => 0.0];
    foreach ($days as $r) {
        if (in_array($r['status'], ['present', 'late', 'half', 'missed', 'in'], true)) {
            $t['present']++;
        }
        if ($r['late']) {
            $t['late']++;
        }
        foreach (['half', 'absent', 'leave', 'missed'] as $k) {
            $t[$k] += $r['status'] === $k ? 1 : 0;
        }
        $t['off'] += in_array($r['status'], ['off', 'holiday'], true) ? 1 : 0;
        $t['offsite'] += $r['offsite'] ? 1 : 0;
        $t['hours'] += $r['hours'];
    }
    return $t;
}

// People HR sees, optionally only those assigned to one HSEC company.
function att_people(string $company = ''): array
{
    $users = erp_db()->query('SELECT id, name, email, created_at, hsec_ents FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE')->fetchAll();
    if ($company !== '') {
        $users = array_values(array_filter($users, fn($u) => in_array($company, array_filter(explode(',', $u['hsec_ents'])), true)));
    }
    return $users;
}

// ---- Pages ----

function att_page(bool $post): void
{
    $me = erp_require_user();
    $hr = att_hr($me);
    $db = erp_db();
    $tab = (string) ($_GET['tab'] ?? 'me');
    if (!in_array($tab, ['me', 'today', 'month', 'requests', 'settings'], true) || ($tab !== 'me' && $hr === '') || ($tab === 'settings' && $hr !== 'edit')) {
        $tab = 'me';
    }
    $errors = [];

    if ($post) {
        $action = (string) ($_POST['action'] ?? '');
        if ($action === 'request') {
            $type = ($_POST['type'] ?? '') === 'leave' ? 'leave' : 'correction';
            $reason = trim(mb_substr((string) ($_POST['reason'] ?? ''), 0, 500));
            $from = (string) ($_POST[$type === 'leave' ? 'from' : 'day'] ?? '');
            $to = $type === 'leave' ? (string) ($_POST['to'] ?? '') : $from;
            $inT = (string) ($_POST['in_time'] ?? '');
            $outT = (string) ($_POST['out_time'] ?? '');
            $ok = fn($d) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d);
            $okT = fn($t) => $t === '' || preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t);
            if (!$ok($from) || !$ok($to) || $to < $from) {
                $errors[] = 'Pick valid dates.';
            } elseif ($type === 'correction' && ($from > date('Y-m-d') || ($inT === '' && $outT === '') || !$okT($inT) || !$okT($outT))) {
                $errors[] = 'Pick a past date and the check-in and/or check-out time that should be recorded.';
            } elseif ($reason === '') {
                $errors[] = 'Write a short reason.';
            } else {
                $db->prepare('INSERT INTO att_requests (user_id, type, day_from, day_to, in_time, out_time, leave_type, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                    ->execute([$me['id'], $type, $from, $to, $inT ?: null, $outT ?: null,
                        $type === 'leave' && isset(ATT_LEAVE_TYPES[$_POST['leave_type'] ?? '']) ? $_POST['leave_type'] : ($type === 'leave' ? 'casual' : null), $reason, erp_now()]);
                erp_flash($type === 'leave' ? 'Leave request sent for approval.' : 'Correction sent for approval.');
                erp_redirect('/erp/m/attendance');
            }
        } elseif ($action === 'cancel') {
            $db->prepare("DELETE FROM att_requests WHERE id = ? AND user_id = ? AND status = 'pending'")->execute([(int) ($_POST['id'] ?? 0), $me['id']]);
            erp_flash('Request cancelled.');
            erp_redirect('/erp/m/attendance');
        } elseif (($action === 'approve' || $action === 'reject') && $hr === 'edit') {
            $st = $db->prepare("SELECT * FROM att_requests WHERE id = ? AND status = 'pending'");
            $st->execute([(int) ($_POST['id'] ?? 0)]);
            if ($r = $st->fetch()) {
                $db->beginTransaction();
                if ($action === 'approve' && $r['type'] === 'correction') {
                    $add = $db->prepare("INSERT INTO att_punches (user_id, kind, day, at, method, note, by_user) VALUES (?, ?, ?, ?, 'corrected', ?, ?)");
                    if ($r['in_time']) {
                        // A corrected check-in replaces a later one on that day (someone who forgot to press in the morning).
                        $db->prepare("DELETE FROM att_punches WHERE user_id = ? AND day = ? AND kind = 'in' AND at > ? AND id = (SELECT MIN(id) FROM att_punches WHERE user_id = ? AND day = ? AND kind = 'in')")
                            ->execute([$r['user_id'], $r['day_from'], $r['day_from'] . ' ' . $r['in_time'] . ':00', $r['user_id'], $r['day_from']]);
                        $add->execute([$r['user_id'], 'in', $r['day_from'], $r['day_from'] . ' ' . $r['in_time'] . ':00', $r['reason'], $me['id']]);
                    }
                    if ($r['out_time']) {
                        $add->execute([$r['user_id'], 'out', $r['day_from'], $r['day_from'] . ' ' . $r['out_time'] . ':00', $r['reason'], $me['id']]);
                    }
                }
                $db->prepare('UPDATE att_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?')
                    ->execute([$action === 'approve' ? 'approved' : 'rejected', $me['id'], erp_now(), $r['id']]);
                $db->commit();
                erp_flash($action === 'approve' ? 'Approved.' : 'Rejected.');
            }
            erp_redirect('/erp/m/attendance?tab=requests');
        } elseif ($action === 'settings' && $hr === 'edit') {
            $t = fn($k, $d) => preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string) ($_POST[$k] ?? '')) ? $_POST[$k] : $d;
            erp_setting_set('att_start', $t('start', '09:00'));
            erp_setting_set('att_end', $t('end', '18:00'));
            erp_setting_set('att_cutoff', $t('cutoff', '20:00'));
            erp_setting_set('att_grace', (string) max(0, min(180, (int) ($_POST['grace'] ?? 15))));
            erp_setting_set('att_half', (string) max(0, min(12, (float) ($_POST['half'] ?? 4))));
            erp_setting_set('att_off', implode(',', array_intersect(array_map('intval', (array) ($_POST['off'] ?? [])), range(0, 6))));
            erp_setting_set('att_holidays', mb_substr((string) ($_POST['holidays'] ?? ''), 0, 5000));
            $ips = array_filter(array_map('trim', preg_split('/[\s,]+/', (string) ($_POST['ips'] ?? ''))), fn($ip) => @inet_pton(explode('/', $ip)[0]) !== false);
            erp_setting_set('att_ips', implode("\n", array_unique($ips)));
            erp_flash('Attendance settings saved.');
            erp_redirect('/erp/m/attendance?tab=settings');
        } elseif ($action === 'test-mail') {
            erp_flash(att_remind_mail($me) ? 'A test reminder was sent to ' . $me['email'] . '. If it is not in your inbox or spam within a few minutes, e-mail from the ERP is not arriving yet.'
                : 'The server could not send the e-mail. E-mail from the ERP is not working yet.');
            erp_redirect('/erp/m/attendance' . ($hr === 'edit' ? '?tab=settings' : ''));
        } elseif ($action === 'site' && $hr === 'edit') {
            $name = trim(mb_substr((string) ($_POST['name'] ?? ''), 0, 80));
            $lat = (float) ($_POST['lat'] ?? 0);
            $lng = (float) ($_POST['lng'] ?? 0);
            if ($name === '' || !is_numeric($_POST['lat'] ?? '') || !is_numeric($_POST['lng'] ?? '') || abs($lat) > 90 || abs($lng) > 180) {
                erp_flash('Give the site a name and its location (press "Use my location" while standing there, or paste from Google Maps).');
            } else {
                $db->prepare('INSERT INTO att_sites (name, lat, lng, radius) VALUES (?, ?, ?, ?)')->execute([$name, $lat, $lng, max(50, min(5000, (int) ($_POST['radius'] ?? 300)))]);
                erp_flash('Site added.');
            }
            erp_redirect('/erp/m/attendance?tab=settings');
        } elseif ($action === 'site-delete' && $hr === 'edit') {
            $db->prepare('DELETE FROM att_sites WHERE id = ?')->execute([(int) ($_POST['id'] ?? 0)]);
            erp_flash('Site removed.');
            erp_redirect('/erp/m/attendance?tab=settings');
        }
    }

    $month = preg_match('/^\d{4}-\d{2}$/', (string) ($_GET['month'] ?? '')) ? $_GET['month'] : date('Y-m');
    $from = $month . '-01';
    $to = date('Y-m-t', strtotime($from));
    $company = (string) ($_GET['company'] ?? '');
    $names = chat_names();
    $data = ['me' => $me, 'hr' => $hr, 'tab' => $tab, 'errors' => $errors, 'month' => $month, 'cfg' => att_cfg(), 'names' => $names, 'company' => $company];

    if ($tab === 'me') {
        $self = ['id' => $me['id'], 'name' => $me['name'], 'created_at' => $me['created_at']];
        $data['days'] = att_days([$self], $from, min($to, date('Y-m-d')))[$me['id']] ?? [];
        $st = $db->prepare('SELECT * FROM att_requests WHERE user_id = ? ORDER BY id DESC LIMIT 20');
        $st->execute([$me['id']]);
        $data['requests'] = $st->fetchAll();
    } elseif ($tab === 'today') {
        $people = att_people($company);
        $data['people'] = $people;
        $day = date('Y-m-d');
        $data['days'] = array_map(fn($d) => $d[$day], att_days($people, $day, $day));
    } elseif ($tab === 'month') {
        $people = att_people($company);
        $days = att_days($people, $from, $to);
        if (($_GET['csv'] ?? '') === '1') {
            att_csv($people, $days, $month);
        }
        $data['people'] = $people;
        $data['days'] = $days;
        $data['from'] = $from;
        $data['to'] = $to;
    } elseif ($tab === 'requests') {
        $data['requests'] = $db->query("SELECT * FROM att_requests ORDER BY status = 'pending' DESC, id DESC LIMIT 100")->fetchAll();
    } elseif ($tab === 'settings') {
        $data['sites'] = $db->query('SELECT * FROM att_sites ORDER BY name')->fetchAll();
        $data['myIp'] = erp_ip();
        $data['myEntry'] = att_ip_entry(erp_ip());
    }
    $data['pending'] = $hr ? (int) $db->query("SELECT COUNT(*) FROM att_requests WHERE status = 'pending'")->fetchColumn() : 0;
    erp_render('attendance', $data);
}

function att_csv(array $people, array $days, string $month): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="attendance-' . $month . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    $dates = array_keys(reset($days) ?: []);
    fputcsv($out, array_merge(['Name', 'E-mail', 'Present', 'Late', 'Half days', 'Absent', 'Leave', 'Missed checkout', 'Away from known sites', 'Hours'], array_map(fn($d) => substr($d, 8), $dates)));
    foreach ($people as $u) {
        $d = $days[$u['id']] ?? [];
        $t = att_totals($d);
        fputcsv($out, array_merge([$u['name'], $u['email'], $t['present'], $t['late'], $t['half'], $t['absent'], $t['leave'], $t['missed'], $t['offsite'], round($t['hours'], 1)],
            array_map(fn($r) => ATT_STATUS[$r['status']][0] . ($r['late'] && $r['status'] !== 'late' ? '*' : ''), $d)));
    }
    exit;
}

// ---- End-of-day reminders ----

function att_remind_mail(array $u): bool
{
    $c = att_cfg();
    return erp_mail($u['email'], 'Reminder: check out of FlowSuit ERP', 'Hello ' . $u['name'] . ",\r\n\r\n"
        . 'The working day ended at ' . $c['end'] . " and you are still checked in.\r\n"
        . "Open the ERP and press Check out in the bottom-right corner:\r\n"
        . erp_base_url() . "/erp/m/attendance\r\n\r\n"
        . 'If you left already, ask for a correction on the same page. After ' . $c['cutoff'] . " the day is marked \"Missed checkout\".\r\n\r\nFlowSuit ERP\r\n");
}

// After the end of the working day: everyone still checked in gets one e-mail.
function att_reminders(): int
{
    $c = att_cfg();
    $day = date('Y-m-d');
    if (date('H:i') < $c['end'] || date('H:i') >= $c['cutoff']) {
        return 0;
    }
    $db = erp_db();
    $st = $db->prepare("SELECT u.id, u.name, u.email FROM att_punches p JOIN users u ON u.id = p.user_id AND u.active = 1
        WHERE p.day = ? AND p.kind = 'in' AND p.id = (SELECT MAX(id) FROM att_punches WHERE user_id = p.user_id AND day = p.day)
        AND NOT EXISTS (SELECT 1 FROM att_sent s WHERE s.user_id = p.user_id AND s.day = p.day AND s.kind = 'out')");
    $st->execute([$day]);
    $sent = 0;
    foreach ($st->fetchAll() as $u) {
        $db->prepare("INSERT OR IGNORE INTO att_sent (user_id, day, kind) VALUES (?, ?, 'out')")->execute([$u['id'], $day]);
        $sent += att_remind_mail($u) ? 1 : 0;
    }
    return $sent;
}

// Without a cron job the reminders still go out, as long as someone has the ERP open (checked at most every 5 minutes).
function att_reminders_maybe(): void
{
    $last = (int) (erp_setting('att_last_run') ?? 0);
    if (time() - $last >= 300 && date('H:i') >= att_cfg()['end']) {
        erp_setting_set('att_last_run', (string) time());
        att_reminders();
    }
}
