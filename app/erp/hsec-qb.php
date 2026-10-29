<?php
// Moving HSEC's books from QuickBooks: clear the old records, then load the QuickBooks
// Journal report (Reports › Accountant & Taxes › Journal, inception to date) one company at a time.
// Each QuickBooks account is matched once to an account in the HSEC chart; the match is remembered.
// Every QuickBooks transaction becomes one posted voucher, so the trial balance matches QuickBooks.

const HSEC_QB_MAX_ROWS = 300000;
const HSEC_KEEP = ['settings', 'secusers', 'accounts'];   // setup that "Clear" leaves in place

function hsec_qb_db(): PDO
{
    $db = hsec_db();
    $db->exec('CREATE TABLE IF NOT EXISTS hsec_qbmap (qb_name TEXT PRIMARY KEY, account_id TEXT NOT NULL)');
    return $db;
}

// Deletes every HSEC record except the company setup, chart of accounts and users & roles.
// Each deletion is still written to hsec_history, so nothing is lost for good.
function hsec_clear(array $me): int
{
    $db = hsec_db();
    $db->exec('BEGIN IMMEDIATE');
    try {
        $v = (int) $db->query('SELECT COALESCE(MAX(ver), 0) FROM hsec_docs')->fetchColumn();
        $marks = implode(',', array_fill(0, count(HSEC_KEEP), '?'));
        $st = $db->prepare("SELECT coll, id, data FROM hsec_docs WHERE data IS NOT NULL AND coll NOT IN ($marks)");
        $st->execute(HSEC_KEEP);
        $n = 0;
        foreach ($st->fetchAll() as $r) {
            hsec_put($db, $me, $r['coll'], $r['id'], null, $r['data'], ++$v);
            $n++;
        }
        $db->exec('COMMIT');
    } catch (Throwable $ex) {
        if ($db->inTransaction()) {
            $db->exec('ROLLBACK');
        }
        throw $ex;
    }
    return $n;
}

function hsec_doc(string $coll, string $id): ?array
{
    $old = hsec_old(hsec_db(), $coll, $id);
    return $old === null ? null : json_decode($old, true);
}

// Companies from HSEC's own setup: code => "Legal name (CODE)".
function hsec_companies(): array
{
    $s = hsec_doc('settings', 'main') ?? [];
    $codes = is_array($s['entities'] ?? null) && $s['entities'] ? $s['entities'] : ['ENT1', 'ENT2', 'ENT3', 'ENT4', 'ENT5'];
    $out = [];
    foreach ($codes as $c) {
        $legal = $s['legal'][$c] ?? '';
        $out[(string) $c] = $legal !== '' && $legal !== $c ? $legal . ' (' . $c . ')' : (string) $c;
    }
    return $out;
}

// Posting accounts of the HSEC chart: id => ['code', 'name', 'type'].
function hsec_posting_accounts(): array
{
    $out = [];
    foreach (hsec_db()->query("SELECT id, data FROM hsec_docs WHERE coll = 'accounts' AND data IS NOT NULL") as $r) {
        $a = json_decode($r['data'], true);
        if (($a['posting'] ?? 'Posting') === 'Posting') {
            $out[$r['id']] = ['code' => (string) ($a['code'] ?? ''), 'name' => (string) ($a['name'] ?? ''), 'type' => (string) ($a['type'] ?? '')];
        }
    }
    uasort($out, fn($a, $b) => strcmp($a['code'], $b['code']));
    return $out;
}

function hsec_qb_date(string $v, string $order): ?string
{
    $v = trim($v);
    if ($v === '') {
        return null;
    }
    if (is_numeric($v) && $v > 20000 && $v < 80000) {
        return gmdate('Y-m-d', (int) round(((float) $v - 25569) * 86400));
    }
    if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})/', $v, $m)) {
        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) ? sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]) : null;
    }
    if (preg_match('#^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$#', $v, $m)) {
        [$a, $b, $y] = [(int) $m[1], (int) $m[2], (int) $m[3]];
        $y += $y < 100 ? 2000 : 0;
        [$mo, $d] = $order === 'dmy' ? [$b, $a] : [$a, $b];
        return checkdate($mo, $d, $y) ? sprintf('%04d-%02d-%02d', $y, $mo, $d) : null;
    }
    $t = strtotime($v . ' 00:00 UTC');   // "May 1, 2025", "01-May-2025", "1 May 2025"
    return $t ? gmdate('Y-m-d', $t) : null;
}

// Day/month order of slash dates: 'dmy' or 'mdy' when the file shows it, null when every date is ambiguous.
function hsec_qb_date_order(array $values): ?string
{
    foreach ($values as $v) {
        if (preg_match('#^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}$#', trim($v), $m)) {
            if ((int) $m[1] > 12) {
                return 'dmy';
            }
            if ((int) $m[2] > 12) {
                return 'mdy';
            }
        }
    }
    return null;
}

// "1010 · Bank:HBL Current" -> "Bank:HBL Current"; the account number is kept apart.
function hsec_qb_account(string $v): array
{
    $v = trim(preg_replace('/\s+/', ' ', $v));
    $num = '';
    if (preg_match('/^(\d[\d.-]*)\s*[·•\-]\s*(.+)$/u', $v, $m)) {
        [$num, $v] = [$m[1], trim($m[2])];
    }
    return [$v, $num];
}

// Reads the Journal report into transactions. Works with QuickBooks Desktop (Trans #, Type, Date,
// Num, Name, Memo, Account, Debit, Credit) and QuickBooks Online (Date, Transaction Type, Num, Name,
// Memo/Description, Account, Debit, Credit) exports, as .xlsx or .csv.
function hsec_qb_parse(string $path, string $name, string $dateOrder): array
{
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if ($ext === 'xlsx') {
        $grid = erp_read_xlsx($path, HSEC_QB_MAX_ROWS);
    } elseif ($ext === 'csv') {
        $grid = erp_read_csv($path, HSEC_QB_MAX_ROWS);
    } else {
        throw new RuntimeException('Upload the Journal report as Excel (.xlsx) or .csv. An old .xls: open it in Excel and "Save as" .xlsx first.');
    }
    if (count($grid) >= HSEC_QB_MAX_ROWS) {
        throw new RuntimeException('The report has more than ' . number_format(HSEC_QB_MAX_ROWS) . ' rows. Export it in two date ranges and upload each.');
    }

    $col = null;
    foreach ($grid as $i => $row) {
        $h = array_map(fn($v) => strtolower(trim(preg_replace('/\s+/', ' ', (string) $v))), $row);
        $find = function (array $names) use ($h): ?int {
            foreach ($names as $n) {
                $k = array_search($n, $h, true);
                if ($k !== false) {
                    return $k;
                }
            }
            return null;
        };
        $acc = $find(['account', 'account full name', 'account name', 'full name']);
        $dr = $find(['debit', 'debits']);
        $cr = $find(['credit', 'credits']);
        if ($acc !== null && $dr !== null && $cr !== null) {
            $col = ['acc' => $acc, 'dr' => $dr, 'cr' => $cr, 'head' => $i,
                'trans' => $find(['trans #', 'trans#', 'transaction id', 'trans no', 'trans no.']),
                'type' => $find(['type', 'transaction type']),
                'date' => $find(['date', 'transaction date']),
                'num' => $find(['num', 'no.', 'number', 'ref no.', 'ref no']),
                'name' => $find(['name', 'payee', 'customer/vendor']),
                'job' => $find(['customer:job', 'customer: job', 'customer', 'job', 'project', 'customer/project']),
                'memo' => $find(['memo', 'memo/description', 'description', 'line description'])];
            break;
        }
        if ($i > 40) {
            break;
        }
    }
    if ($col === null || $col['date'] === null) {
        throw new RuntimeException('This does not look like a QuickBooks Journal report: no heading row with Date, Account, Debit and Credit.');
    }

    $cell = fn(array $row, ?int $k): string => $k === null ? '' : trim((string) ($row[$k] ?? ''));
    $body = array_slice($grid, $col['head'] + 1);
    if ($dateOrder === 'auto') {
        $dateOrder = hsec_qb_date_order(array_map(fn($r) => $cell($r, $col['date']), $body)) ?? '';
        $slash = false;
        foreach ($body as $r) {
            if (preg_match('#^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$#', $cell($r, $col['date']))) {
                $slash = true;
                break;
            }
        }
        if ($slash && $dateOrder === '') {
            throw new RuntimeException('Every date in the file could be read two ways (like 05/06/2025). Choose the date format and upload again.');
        }
    }

    $txns = [];
    $cur = null;
    $close = function () use (&$cur, &$txns): void {
        if ($cur && $cur['lines']) {
            $txns[] = $cur;
        }
        $cur = null;
    };
    $last = ['trans' => '', 'type' => '', 'date' => null, 'num' => ''];
    foreach ($body as $r) {
        [$acct, $acctNum] = hsec_qb_account($cell($r, $col['acc']));
        $dr = erp_number($cell($r, $col['dr'])) ?? 0.0;
        $cr = erp_number($cell($r, $col['cr'])) ?? 0.0;
        $trans = $cell($r, $col['trans']);
        $dateRaw = $cell($r, $col['date']);
        $first = $cell($r, 0) . $cell($r, 1);
        if ($acct === '') {
            // A total row (amounts with no account) or a blank or title row ends the transaction.
            $close();
            continue;
        }
        if (preg_match('/^total\b/i', $first)) {
            $close();
            continue;
        }
        $date = $dateRaw !== '' ? hsec_qb_date($dateRaw, $dateOrder) : null;
        if ($dateRaw !== '' && $date === null) {
            throw new RuntimeException('Could not read the date "' . mb_substr($dateRaw, 0, 30) . '". Choose the date format and upload again.');
        }
        $type = $cell($r, $col['type']);
        $num = $cell($r, $col['num']);
        $starts = $cur === null
            || ($col['trans'] !== null && $trans !== '' && $trans !== $cur['trans'])
            || ($col['trans'] === null && $date !== null && ($date !== $cur['date'] || $type !== $cur['type'] || $num !== $cur['num']));
        if ($starts) {
            $close();
            $cur = ['trans' => $trans !== '' ? $trans : $last['trans'], 'type' => $type !== '' ? $type : $last['type'],
                'date' => $date ?? $last['date'], 'num' => $num !== '' ? $num : ($date === null ? $last['num'] : ''), 'lines' => []];
        }
        if (!$cur['date']) {
            throw new RuntimeException('A transaction near account "' . mb_substr($acct, 0, 40) . '" has no date.');
        }
        $last = ['trans' => $cur['trans'], 'type' => $cur['type'], 'date' => $cur['date'], 'num' => $cur['num']];
        if (abs($dr) < 0.005 && abs($cr) < 0.005) {
            continue;
        }
        // A negative debit is a credit, and the other way round.
        if ($dr < 0 || $cr < 0) {
            [$dr, $cr] = [max($dr, 0) + max(-$cr, 0), max($cr, 0) + max(-$dr, 0)];
        }
        $cur['lines'][] = ['qb' => $acct, 'qbNum' => $acctNum, 'debit' => round($dr, 2), 'credit' => round($cr, 2),
            'name' => $cell($r, $col['name']), 'job' => $cell($r, $col['job']), 'memo' => mb_substr($cell($r, $col['memo']), 0, 300)];
    }
    $close();
    if (!$txns) {
        throw new RuntimeException('Found the headings but no transactions under them.');
    }

    $sum = ['debit' => 0.0, 'credit' => 0.0, 'lines' => 0, 'from' => null, 'to' => null];
    $accounts = [];
    $unbalanced = [];
    foreach ($txns as $k => $t) {
        $d = $c = 0.0;
        foreach ($t['lines'] as $l) {
            $d += $l['debit'];
            $c += $l['credit'];
            $accounts[$l['qb']] = ($accounts[$l['qb']] ?? 0) + 1;
        }
        $sum['debit'] += $d;
        $sum['credit'] += $c;
        $sum['lines'] += count($t['lines']);
        $sum['from'] = min($sum['from'] ?? $t['date'], $t['date']);
        $sum['to'] = max($sum['to'] ?? $t['date'], $t['date']);
        if (abs($d - $c) >= 0.01) {
            $unbalanced[] = ['n' => $k, 'date' => $t['date'], 'num' => $t['num'], 'type' => $t['type'], 'diff' => round($d - $c, 2)];
        }
    }
    ksort($accounts, SORT_NATURAL | SORT_FLAG_CASE);
    return ['txns' => $txns, 'sum' => $sum, 'accounts' => $accounts, 'unbalanced' => $unbalanced];
}

// The HSEC account to suggest for a QuickBooks account: the remembered match, else the same name.
function hsec_qb_suggest(array $qbNames, array $posting): array
{
    $map = [];
    foreach (hsec_qb_db()->query('SELECT qb_name, account_id FROM hsec_qbmap') as $r) {
        $map[$r['qb_name']] = $r['account_id'];
    }
    $byName = [];
    foreach ($posting as $id => $a) {
        $byName[mb_strtolower($a['name'])] = $id;
    }
    $out = [];
    foreach ($qbNames as $qb) {
        $leaf = mb_strtolower(trim((string) preg_replace('/^.*:/', '', $qb)));
        $id = $map[$qb] ?? $byName[mb_strtolower($qb)] ?? $byName[$leaf] ?? '';
        $out[$qb] = isset($posting[$id]) ? $id : '';
    }
    return $out;
}

// HSEC voucher type for a QuickBooks transaction type.
function hsec_qb_vtype(string $type, array $lines): array
{
    $t = strtolower($type);
    $cash = false;
    foreach ($lines as $l) {
        if (preg_match('/\bcash\b|petty/i', $l['qb'])) {
            $cash = true;
        }
    }
    if (preg_match('/check|cheque|bill pmt|bill payment|expense|paycheck|liability|payment to|transfer out|credit card/', $t)) {
        return $cash ? ['Cash payment voucher', 'CPV'] : ['Bank payment voucher', 'BPV'];
    }
    if (preg_match('/deposit|receive payment|^payment$|sales receipt|receipt/', $t)) {
        return $cash ? ['Cash receipt voucher', 'CRV'] : ['Bank receipt voucher', 'BRV'];
    }
    if (preg_match('/^invoice$/', $t)) {
        return ['Sales invoice', 'SINV'];
    }
    return ['Journal voucher', 'JV'];
}

// The company's projects, for linking QuickBooks lines to them: [['id', 'name', 'code', 'customer'], ...].
function hsec_qb_projects(PDO $db, string $entity): array
{
    $out = [];
    foreach ($db->query("SELECT id, data FROM hsec_docs WHERE coll = 'projects' AND data IS NOT NULL") as $r) {
        $p = json_decode($r['data'], true) ?: [];
        if (($p['entity'] ?? '') === $entity && trim((string) ($p['name'] ?? '')) !== '') {
            $out[] = ['id' => $r['id'], 'name' => mb_strtolower(trim((string) $p['name'])), 'code' => mb_strtolower(trim((string) ($p['code'] ?? ''))),
                'customer' => mb_strtolower(trim((string) ($p['customer'] ?? '')))];
        }
    }
    return $out;
}

// The project a QuickBooks name (Customer:Job, job or customer) belongs to: the same name or code, the last part of
// "Customer:Job", a name that contains exactly one project's name, or a customer with exactly one project. Same
// rules as FS_QBP.match in hsec-qbproj.js, which links vouchers imported before this existed.
function hsec_qb_match(array $projects, string $name): ?string
{
    $s = mb_strtolower(trim($name));
    if ($s === '' || !$projects) {
        return null;
    }
    $parts = array_values(array_filter(array_map('trim', explode(':', $s)), 'strlen'));
    foreach ([$s, end($parts) ?: $s] as $k) {
        foreach ($projects as $p) {
            if ($k === $p['name'] || ($p['code'] !== '' && $k === $p['code'])) {
                return $p['id'];
            }
        }
    }
    $in = array_values(array_filter($projects, fn($p) => mb_strlen($p['name']) > 3 && mb_strpos($s, $p['name']) !== false));
    if (count($in) === 1) {
        return $in[0]['id'];
    }
    $cu = array_values(array_filter($projects, fn($p) => $p['customer'] !== '' && in_array($p['customer'], [$s, $parts[0] ?? ''], true)));
    return count($cu) === 1 ? $cu[0]['id'] : null;
}

// Writes the parsed transactions as posted vouchers for one company. Ids come from the QuickBooks
// transaction, so loading the same report again changes nothing.
function hsec_qb_import(array $me, array $parsed, string $entity, array $mapping): array
{
    $db = hsec_qb_db();
    $now = gmdate('Y-m-d\TH:i:s.000\Z');
    $s = hsec_doc('settings', 'main') ?? [];
    $dept = is_array($s['departments'] ?? null) && $s['departments'] ? (string) $s['departments'][0] : '';
    $txns = $parsed['txns'];
    usort($txns, fn($a, $b) => [$a['date'], $a['trans']] <=> [$b['date'], $b['trans']]);

    $db->exec('BEGIN IMMEDIATE');
    try {
        $saveMap = $db->prepare('INSERT INTO hsec_qbmap (qb_name, account_id) VALUES (?, ?) ON CONFLICT(qb_name) DO UPDATE SET account_id = excluded.account_id');
        foreach ($mapping as $qb => $id) {
            $saveMap->execute([$qb, $id]);
        }
        // Voucher numbers continue from the highest one already used for this company.
        $next = [];
        $st = $db->prepare("SELECT data FROM hsec_docs WHERE coll = 'journals' AND data IS NOT NULL");
        $st->execute();
        foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $json) {
            $ref = (string) (json_decode($json, true)['ref'] ?? '');
            if (preg_match('/^([A-Z]+)-' . preg_quote($entity, '/') . '-(\d+)$/', $ref, $m)) {
                $next[$m[1]] = max($next[$m[1]] ?? 0, (int) $m[2]);
            }
        }
        $v = (int) $db->query('SELECT COALESCE(MAX(ver), 0) FROM hsec_docs')->fetchColumn();
        $done = $same = $kept = $linked = 0;
        $seen = [];
        $projects = hsec_qb_projects($db, $entity);
        foreach ($txns as $i => $t) {
            $key = $t['trans'] !== '' ? $t['trans'] : $t['date'] . '-' . ($i + 1);
            $id = 'qb-' . $entity . '-' . preg_replace('/[^A-Za-z0-9_.:-]/', '', $key);
            $id = isset($seen[$id]) ? $id . '-' . ($i + 1) : $id;
            $seen[$id] = true;
            $id = substr($id, 0, 100);
            $oldJson = hsec_old($db, 'journals', $id);
            [$vtype, $prefix] = hsec_qb_vtype($t['type'], $t['lines']);
            $old = $oldJson === null ? null : json_decode($oldJson, true);
            $lines = array_map(fn($l) => ['account' => $mapping[$l['qb']], 'debit' => hsec_qb_amount($l['debit']),
                'credit' => hsec_qb_amount($l['credit']), 'desc' => $l['memo'], 'party' => $l['name']], $t['lines']);
            $memo = '';
            $payee = '';
            foreach ($t['lines'] as $l) {
                $memo = $memo !== '' ? $memo : $l['memo'];
                $payee = $payee !== '' ? $payee : $l['name'];
            }
            // the voucher goes to a project when its lines name exactly one of the company's projects
            $pids = [];
            foreach ($t['lines'] as $l) {
                $pid = hsec_qb_match($projects, ($l['job'] ?? '') !== '' ? $l['job'] : $l['name']);
                if ($pid !== null) {
                    $pids[$pid] = true;
                }
            }
            $cc = count($pids) === 1 ? (string) array_key_first($pids) : (string) ($old['costCentre'] ?? '');
            $ref = $old['ref'] ?? sprintf('%s-%s-%04d', $prefix, $entity, $next[$prefix] = ($next[$prefix] ?? 0) + 1);
            $rec = ['approvals' => [], 'createdAt' => $old['createdAt'] ?? $now, 'date' => $t['date'], 'dept' => $dept, 'entity' => $entity,
                'lines' => $lines, 'maker' => ['at' => $now, 'name' => 'QuickBooks import'], 'narration' => $memo !== '' ? $memo : trim($t['type'] . ' ' . $t['num']),
                'opening' => 'No', 'payee' => $payee, 'postedBy' => ['at' => $now, 'auto' => true, 'name' => 'QuickBooks import'],
                'qbNum' => $t['num'], 'qbTrans' => $t['trans'], 'qbType' => $t['type'], 'ref' => $ref,
                'source' => ['c' => 'qbimport', 'id' => 'QB-' . $entity . '-' . $key], 'status' => 'Posted', 'updatedAt' => $now, 'vtype' => $vtype];
            if ($cc !== '') {
                $rec['costCentre'] = $cc;
                $linked++;
            }
            if ($old !== null) {
                $rec['maker'] = $old['maker'] ?? $rec['maker'];
                $rec['postedBy'] = $old['postedBy'] ?? $rec['postedBy'];
                $rec['updatedAt'] = $old['updatedAt'] ?? $now;
                if (json_encode($old['lines'] ?? null) === json_encode($lines) && ($old['date'] ?? '') === $t['date'] && (string) ($old['costCentre'] ?? '') === $cc) {
                    $same++;
                    continue;
                }
                if (hsec_refusal($me, 'journals', $old, $rec) !== null) {
                    $kept++;
                    continue;
                }
            }
            $json = json_encode($rec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            hsec_put($db, $me, 'journals', $id, $json, $oldJson, ++$v);
            $done++;
        }
        $db->exec('COMMIT');
    } catch (Throwable $ex) {
        if ($db->inTransaction()) {
            $db->exec('ROLLBACK');
        }
        throw $ex;
    }
    return ['done' => $done, 'same' => $same, 'kept' => $kept, 'linked' => $linked];
}

// Whole rupees stay whole numbers, the way the rest of the HSEC books store them.
function hsec_qb_amount(float $v)
{
    return abs($v - round($v)) < 0.005 ? (int) round($v) : round($v, 2);
}

// Parsed reports wait on the server between "Check" and "Import", tied to this session.
function hsec_qb_stash(array $parsed, string $entity, string $file): string
{
    $dir = erp_data_dir() . '/tmp';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    foreach (glob($dir . '/qb-*.json') ?: [] as $f) {
        if (filemtime($f) < time() - 86400) {
            @unlink($f);
        }
    }
    $token = bin2hex(random_bytes(16));
    file_put_contents($dir . '/qb-' . $token . '.json', json_encode($parsed + ['entity' => $entity, 'file' => $file], JSON_UNESCAPED_UNICODE));
    $_SESSION['hsec_qb'] = $token;
    return $token;
}

function hsec_qb_unstash(): ?array
{
    $token = (string) ($_SESSION['hsec_qb'] ?? '');
    $f = erp_data_dir() . '/tmp/qb-' . $token . '.json';
    if (!preg_match('/^[a-f0-9]{32}$/', $token) || !is_file($f)) {
        return null;
    }
    return json_decode((string) file_get_contents($f), true);
}

function hsec_qb_drop(): void
{
    $token = (string) ($_SESSION['hsec_qb'] ?? '');
    if (preg_match('/^[a-f0-9]{32}$/', $token)) {
        @unlink(erp_data_dir() . '/tmp/qb-' . $token . '.json');
    }
    unset($_SESSION['hsec_qb']);
}

// The admin page actions for the QuickBooks move: clear, check a report, import it.
function hsec_qb_action(array $me, string $action): ?string
{
    if ($action === 'clear') {
        if (trim((string) ($_POST['confirm'] ?? '')) !== 'CLEAR') {
            throw new RuntimeException('Type CLEAR to confirm.');
        }
        $n = hsec_clear($me);
        return 'Cleared ' . number_format($n) . ' old records. The chart of accounts, companies and users & roles are kept.';
    }
    if ($action === 'qb_check') {
        $companies = hsec_companies();
        $entity = (string) ($_POST['entity'] ?? '');
        if (!isset($companies[$entity])) {
            throw new RuntimeException('Choose the company this report belongs to.');
        }
        $up = $_FILES['journal'] ?? null;
        if (!$up || $up['error'] !== UPLOAD_ERR_OK) {
            throw new RuntimeException($up && in_array($up['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
                ? 'The file is larger than this server accepts. Save it as .xlsx (smaller than .csv), or export it in two date ranges.'
                : 'Choose the Journal report file (.xlsx or .csv).');
        }
        $order = in_array($_POST['dates'] ?? '', ['dmy', 'mdy'], true) ? $_POST['dates'] : 'auto';
        hsec_qb_drop();
        hsec_qb_stash(hsec_qb_parse($up['tmp_name'], (string) $up['name'], $order), $entity, mb_substr(basename((string) $up['name']), 0, 120));
        return null;
    }
    if ($action === 'qb_cancel') {
        hsec_qb_drop();
        return null;
    }
    if ($action === 'qb_import') {
        $p = hsec_qb_unstash();
        if (!$p) {
            throw new RuntimeException('That report check has expired. Upload the report again.');
        }
        if ($p['unbalanced']) {
            throw new RuntimeException('Some transactions do not balance. Fix them in QuickBooks and export again.');
        }
        $posting = hsec_posting_accounts();
        $mapping = [];
        $missing = 0;
        foreach (array_keys($p['accounts']) as $i => $qb) {
            $id = (string) ($_POST['map'][$i] ?? '');
            if (!isset($posting[$id])) {
                $missing++;
                continue;
            }
            $mapping[$qb] = $id;
        }
        if ($missing) {
            // Keep what was picked so far, so the admin does not have to choose again.
            hsec_qb_db();
            $save = hsec_db()->prepare('INSERT INTO hsec_qbmap (qb_name, account_id) VALUES (?, ?) ON CONFLICT(qb_name) DO UPDATE SET account_id = excluded.account_id');
            foreach ($mapping as $qb => $id) {
                $save->execute([$qb, $id]);
            }
            throw new RuntimeException('Choose an HSEC account for every QuickBooks account (' . $missing . ' left).');
        }
        $r = hsec_qb_import($me, $p, (string) $p['entity'], $mapping);
        hsec_qb_drop();
        return 'Imported ' . number_format($r['done']) . ' vouchers for ' . $p['entity']
            . ($r['same'] ? ', ' . number_format($r['same']) . ' were already here' : '')
            . ($r['kept'] ? ', ' . number_format($r['kept']) . ' posted vouchers kept as they are' : '')
            . ($r['linked'] ? '; ' . number_format($r['linked']) . ' linked to their project by the QuickBooks name (Customer:Job)' : '') . '.';
    }
    return null;
}
