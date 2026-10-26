<?php
// Figures for the ERP dashboard (/erp), each limited to what this person may see: HSEC vouchers only with HSEC
// access and only for their companies; the whole team's attendance only for HR and admins.

function erp_home_data(array $me): array
{
    $out = ['att' => att_on($me) ? erp_home_att($me) : null, 'hsec' => null];
    if (erp_can($me, 'hsec')) {
        try {
            $out['hsec'] = erp_home_hsec($me);
        } catch (Throwable $ex) {
            $out['hsec'] = null;   // the dashboard must open even if the books cannot be read
        }
    }
    return $out;
}

function erp_home_att(array $me): array
{
    $today = date('Y-m-d');
    if (att_hr($me) !== '') {
        $people = att_people();
        $days = att_days($people, $today, $today);
        $n = ['in' => 0, 'late' => 0, 'out' => 0, 'leave' => 0, 'off' => 0];
        foreach ($days as $row) {
            $r = $row[$today];
            if (in_array($r['status'], ['present', 'late', 'half', 'in', 'missed'], true)) {
                $n[$r['late'] ? 'late' : 'in']++;
            } elseif ($r['status'] === 'leave') {
                $n['leave']++;
            } elseif (in_array($r['status'], ['off', 'holiday', 'none'], true)) {
                $n['off']++;
            } else {
                $n['out']++;
            }
        }
        return ['team' => true, 'n' => $n, 'total' => count($people)];
    }
    $from = date('Y-m-01');
    $days = att_days([$me + ['created_at' => $me['created_at'] ?? $from]], $from, $today)[(int) $me['id']] ?? [];
    $t = att_totals($days);
    return ['team' => false, 'today' => $days[$today]['status'] ?? 'none', 'in' => $days[$today]['in'] ?? null,
        'month' => ['present' => $t['present'], 'late' => $t['late'], 'absent' => $t['absent'], 'leave' => $t['leave']]];
}

function erp_home_hsec(array $me): array
{
    $db = hsec_db();
    $allowed = hsec_allowed($me);
    $where = "coll = 'journals' AND data IS NOT NULL";
    $args = [];
    if ($allowed !== null) {
        $where .= ' AND json_extract(data, \'$.entity\') IN (' . implode(',', array_fill(0, count($allowed), '?')) . ')';
        $args = $allowed;
    }
    $amt = "(SELECT COALESCE(SUM(CAST(json_extract(l.value, '$.debit') AS REAL)), 0) FROM json_each(json_extract(data, '$.lines')) l)";

    $st = $db->prepare("SELECT COALESCE(json_extract(data, '$.status'), 'Draft') s, COUNT(*) n FROM hsec_docs WHERE $where GROUP BY s");
    $st->execute($args);
    $status = array_column($st->fetchAll(), 'n', 's');

    // Posted vouchers per month for the last twelve months that have any.
    $st = $db->prepare("SELECT substr(json_extract(data, '$.date'), 1, 7) m, COUNT(*) n, SUM($amt) v FROM hsec_docs
        WHERE $where AND json_extract(data, '$.status') = 'Posted' AND json_extract(data, '$.date') IS NOT NULL GROUP BY m ORDER BY m DESC LIMIT 12");
    $st->execute($args);
    $months = array_reverse(array_map(fn($r) => ['m' => $r['m'], 'n' => (int) $r['n'], 'v' => (float) $r['v']], $st->fetchAll()));

    // By type, for the donut.
    $st = $db->prepare("SELECT COALESCE(json_extract(data, '$.vtype'), 'Journal voucher') t, COUNT(*) n FROM hsec_docs WHERE $where GROUP BY t ORDER BY n DESC");
    $st->execute($args);
    $types = $st->fetchAll();
    $top = array_slice($types, 0, 4);
    $rest = array_sum(array_column(array_slice($types, 4), 'n'));
    if ($rest) {
        $top[] = ['t' => 'Other', 'n' => $rest];
    }

    $st = $db->prepare("SELECT id, json_extract(data, '$.ref') ref, json_extract(data, '$.entity') ent, json_extract(data, '$.vtype') vt,
        json_extract(data, '$.date') d, COALESCE(json_extract(data, '$.status'), 'Draft') s, json_extract(data, '$.narration') nar, $amt a
        FROM hsec_docs WHERE $where ORDER BY updated_at DESC, ver DESC LIMIT 8");
    $st->execute($args);
    $recent = $st->fetchAll();

    // Vouchers waiting for this person's approval.
    $mine = 0;
    $role = (string) ($me['hsec_jv'] ?? '');
    if (hsec_approvals_on() && isset(HSEC_JV_STAGES[$role])) {
        $st = $db->prepare("SELECT json_extract(data, '$.approvals') ap FROM hsec_docs WHERE $where AND json_extract(data, '$.status') = 'Pending approval'");
        $st->execute($args);
        foreach ($st->fetchAll() as $r) {
            $done = array_column(array_filter(json_decode((string) $r['ap'], true) ?: [], fn($a) => ($a['action'] ?? '') === 'Approved'), 'stage');
            $next = in_array(HSEC_JV_STAGES['senior'], $done, true) ? 'gmf' : 'senior';
            $mine += $next === $role && !in_array(HSEC_JV_STAGES['gmf'], $done, true) ? 1 : 0;
        }
    }
    return ['status' => $status, 'months' => $months, 'types' => $top, 'recent' => $recent, 'mine' => $mine,
        'role' => $role, 'on' => hsec_approvals_on()];
}

// 1,234,567 -> "1.23M", for tiles and chart labels.
function erp_short(float $v): string
{
    $a = abs($v);
    return $a >= 1e9 ? round($v / 1e9, 2) . 'B' : ($a >= 1e6 ? round($v / 1e6, 2) . 'M' : ($a >= 1e3 ? round($v / 1e3, 1) . 'K' : (string) round($v)));
}
