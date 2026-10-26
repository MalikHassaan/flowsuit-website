<?php
$title = 'Dashboard | FlowSuit ERP';
$active = 'home';
$h = (int) date('G');
$hello = $h < 12 ? 'Good morning' : ($h < 17 ? 'Good afternoon' : 'Good evening');
$att = $data['att'];
$hs = $data['hsec'];
$attLabel = ['present' => 'Checked in', 'late' => 'Checked in late', 'in' => 'Checked in', 'half' => 'Half day', 'missed' => 'Checked in',
    'pending' => 'Not checked in yet', 'absent' => 'Not checked in', 'leave' => 'On leave', 'off' => 'Day off', 'holiday' => 'Holiday', 'none' => 'Not checked in yet'];
$palette = ['#1F6FB8', '#0B8BD0', '#f59e0b', '#16a34a', '#13304f', '#8b5cf6'];
$pill = ['Posted' => 'ok', 'Approved' => 'info', 'Pending approval' => 'warn', 'Rejected' => 'bad', 'Draft' => 'muted'];
?>
<section class="home-hero">
  <b class="hh-blob b1"></b><b class="hh-blob b2"></b><b class="hh-blob b3"></b>
  <div class="hh-text">
    <p class="hh-date"><?= e(date('l, j F Y')) ?> · <span data-clock><?= e(date('g:i:s a')) ?></span></p>
    <h1><?= e($hello) ?>, <?= e(strtok($me['name'], ' ')) ?></h1>
    <p><?php if (!$att): ?>Welcome back.<?php elseif (!$att['team']): ?>Today: <b><?= e($attLabel[$att['today']] ?? 'Not checked in yet') ?></b><?= $att['in'] ? ' at ' . e($att['in']) : '' ?>.<?php else: ?><b><?= $att['n']['in'] + $att['n']['late'] ?></b> of <?= (int) $att['total'] ?> people are in today.<?php endif; ?>
    <?php if ($hs && $hs['mine']): ?> <a class="hh-cta" href="/erp/m/hsec/app#e_jv"><?= (int) $hs['mine'] ?> voucher<?= $hs['mine'] > 1 ? 's' : '' ?> waiting for your approval</a><?php endif; ?></p>
  </div>
  <div class="hh-pulse" aria-hidden="true"><i></i><i></i><i></i><span><?= icon('erp') ?></span></div>
</section>

<div class="home-kpis">
<?php
$tiles = [];
if ($hs) {
    $tiles[] = ['Vouchers posted', (int) ($hs['status']['Posted'] ?? 0), 'k-blue', 'sheet', 'In the books'];
    $tiles[] = ['Waiting for approval', (int) ($hs['status']['Pending approval'] ?? 0), 'k-amber', 'clock', $hs['on'] ? 'Maker → Senior Manager → GM Finance' : 'Approval on paper'];
    if ($hs['mine'] || isset(HSEC_JV_STAGES[$hs['role']])) {
        $tiles[] = ['Waiting for you', (int) $hs['mine'], 'k-red', 'bolt', HSEC_JV_ROLES[$hs['role']] ?? ''];
    } else {
        $tiles[] = ['Drafts', (int) ($hs['status']['Draft'] ?? 0), 'k-sky', 'sheet', 'Not sent yet'];
    }
}
if (!$att) {
    // no attendance outside HSEC
} elseif ($att['team']) {
    $tiles[] = ['In today', $att['n']['in'] + $att['n']['late'], 'k-green', 'users', $att['n']['late'] . ' late · ' . $att['n']['out'] . ' not in'];
} else {
    $tiles[] = ['Days present', (int) $att['month']['present'], 'k-green', 'clock', 'This month · ' . (int) $att['month']['late'] . ' late'];
}
foreach ($tiles as $i => [$label, $n, $cls, $ic, $sub]): ?>
  <div class="hk <?= $cls ?>" style="--i:<?= $i ?>"><span class="hk-ic"><?= icon($ic) ?></span><small><?= e($label) ?></small><b data-count="<?= (int) $n ?>">0</b><em><?= e($sub) ?></em><i class="hk-shine"></i></div>
<?php endforeach; ?>
</div>

<?php if ($hs && $hs['months']): $max = max(array_column($hs['months'], 'v')) ?: 1; $maxN = max(array_column($hs['months'], 'n')) ?: 1; $cnt = count($hs['months']); ?>
<div class="home-row">
  <section class="panel hc-card">
    <header class="hc-h"><div><h2>Posted vouchers by month</h2><p class="muted small">Value of vouchers posted (bars) and how many (line)<?= hsec_allowed($me) !== null ? ', your companies only' : '' ?>.</p></div><span class="hc-live">Live</span></header>
    <div class="hc-bars" style="--n:<?= $cnt ?>">
<?php foreach ($hs['months'] as $i => $m): ?>
      <div class="hc-col" style="--h:<?= round($m['v'] / $max * 100, 1) ?>%;--i:<?= $i ?>" title="<?= e(date('M Y', strtotime($m['m'] . '-01'))) ?>: <?= $m['n'] ?> vouchers, Rs <?= e(number_format($m['v'])) ?>"><b><?= e(erp_short($m['v'])) ?></b><span></span><small><?= e(date('M', strtotime($m['m'] . '-01'))) ?></small></div>
<?php endforeach; ?>
      <svg class="hc-line" viewBox="0 0 <?= $cnt * 10 ?> 100" preserveAspectRatio="none" aria-hidden="true"><polyline vector-effect="non-scaling-stroke" points="<?= e(implode(' ', array_map(fn($i, $m) => ($i * 10 + 5) . ',' . round(96 - $m['n'] / $maxN * 80, 1), array_keys($hs['months']), $hs['months']))) ?>"/></svg>
    </div>
  </section>
  <section class="panel hc-card hc-donut-card">
    <header class="hc-h"><div><h2>Voucher types</h2><p class="muted small">All vouchers you can see.</p></div></header>
<?php $tot = array_sum(array_column($hs['types'], 'n')) ?: 1; $off = 0; ?>
    <div class="hc-donut">
      <svg viewBox="0 0 42 42"><circle class="hd-track" cx="21" cy="21" r="15.915"/>
<?php foreach ($hs['types'] as $i => $t): $p = $t['n'] / $tot * 100; ?>
        <circle class="hd-seg" cx="21" cy="21" r="15.915" stroke="<?= $palette[$i % 6] ?>" style="--p:<?= round($p, 2) ?>;--o:<?= round($off, 2) ?>;--i:<?= $i ?>"/>
<?php $off += $p; endforeach; ?>
      </svg>
      <div class="hd-mid"><b data-count="<?= (int) $tot ?>">0</b><small>vouchers</small></div>
    </div>
    <ul class="hd-legend">
<?php foreach ($hs['types'] as $i => $t): ?>
      <li><i style="background:<?= $palette[$i % 6] ?>"></i><?= e($t['t']) ?><b><?= number_format($t['n']) ?></b></li>
<?php endforeach; ?>
    </ul>
  </section>
</div>
<?php endif; ?>

<div class="home-row">
<?php if ($hs && $hs['recent']): ?>
  <section class="panel hc-card">
    <header class="hc-h"><div><h2>Latest transactions</h2><p class="muted small">The vouchers changed most recently in HSEC ERP.</p></div><a class="btn btn-ghost" href="/erp/m/hsec/app#e_jv">Open journals</a></header>
    <ul class="tx-feed">
<?php foreach ($hs['recent'] as $i => $r): $s = (string) $r['s']; ?>
      <li style="--i:<?= $i ?>" class="tx-<?= e($pill[$s] ?? 'muted') ?>">
        <span class="tx-dot"></span>
        <div><b><?= e($r['ref'] ?: 'Unnumbered') ?></b> <span class="muted small"><?= e($r['ent']) ?> · <?= e($r['vt'] ?: 'Journal voucher') ?> · <?= $r['d'] ? e(date('j M Y', strtotime($r['d']))) : '' ?></span><small><?= e(mb_strimwidth((string) $r['nar'], 0, 90, '…')) ?></small></div>
        <span class="tx-amt">Rs <?= e(number_format((float) $r['a'])) ?></span>
        <span class="tx-pill"><?= e($s) ?></span>
      </li>
<?php endforeach; ?>
    </ul>
  </section>
<?php endif; ?>
<?php if ($att && $att['team']): $n = $att['n']; $all = max(1, array_sum($n)); $segs = [['in', 'On time', '#16a34a'], ['late', 'Late', '#f59e0b'], ['out', 'Not in yet', '#dc2626'], ['leave', 'On leave', '#8b5cf6'], ['off', 'Day off', '#94a3b8']]; $off = 0; ?>
  <section class="panel hc-card hc-donut-card">
    <header class="hc-h"><div><h2>Attendance today</h2><p class="muted small"><?= e(date('l j M')) ?></p></div><a class="btn btn-ghost" href="/erp/m/attendance?tab=today">Team today</a></header>
    <div class="hc-donut">
      <svg viewBox="0 0 42 42"><circle class="hd-track" cx="21" cy="21" r="15.915"/>
<?php foreach ($segs as $i => [$k, $label, $c]): if (!$n[$k]) continue; $p = $n[$k] / $all * 100; ?>
        <circle class="hd-seg" cx="21" cy="21" r="15.915" stroke="<?= $c ?>" style="--p:<?= round($p, 2) ?>;--o:<?= round($off, 2) ?>;--i:<?= $i ?>"/>
<?php $off += $p; endforeach; ?>
      </svg>
      <div class="hd-mid"><b data-count="<?= $n['in'] + $n['late'] ?>">0</b><small>of <?= (int) $att['total'] ?> in</small></div>
    </div>
    <ul class="hd-legend">
<?php foreach ($segs as [$k, $label, $c]): ?>
      <li><i style="background:<?= $c ?>"></i><?= e($label) ?><b><?= (int) $n[$k] ?></b></li>
<?php endforeach; ?>
    </ul>
  </section>
<?php endif; ?>
</div>

<h2 class="home-sub">Open a system</h2>
<div class="mod-grid">
<?php $i = 0; foreach (erp_live_modules() as $key => $mod): if (!erp_can($me, $key)) continue; ?>
  <a href="/erp/m/<?= e($key) ?>" class="mod-card mc-<?= $i % 4 ?>" style="--i:<?= $i++ ?>">
    <span class="mod-icon"><?= icon($mod['icon']) ?></span>
    <h2><?= e($mod['name']) ?></h2>
    <p><?= e($mod['about']) ?></p>
    <span class="mc-go">Open →</span>
  </a>
<?php endforeach; ?>
<?php if ($i === 0 && !$me['is_admin']): ?>
  <div class="empty"><h2>Nothing to open yet</h2><p class="muted">Ask your admin to give you access to a part of the ERP.</p></div>
<?php endif; ?>
</div>
<script src="/assets/js/erp-home.js?v=1" defer></script>
