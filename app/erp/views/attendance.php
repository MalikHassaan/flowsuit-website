<?php
$title = 'Attendance | FlowSuit ERP';
$active = 'attendance';
$st = fn(string $k) => '<span class="att-st att-' . e($k) . '">' . e(ATT_STATUS[$k][1]) . '</span>';
$map = fn(array $p) => $p['lat'] !== null ? '<a href="https://www.google.com/maps?q=' . e($p['lat'] . ',' . $p['lng']) . '" target="_blank" rel="noopener">Map</a>' . ($p['acc'] ? ' <span class="muted small">±' . (int) $p['acc'] . ' m</span>' : '') : '';
$where = function (array $p): string {
    if ($p['method'] === 'office') {
        return '<span class="tag tag-ok">Office</span>';
    }
    if ($p['method'] === 'corrected') {
        return '<span class="tag">Corrected</span>';
    }
    return $p['site'] ? '<span class="tag tag-ok">At ' . e($p['site']) . '</span>' : '<span class="tag att-flag">Not at a known site' . ($p['site_dist'] !== null ? ' (' . number_format($p['site_dist'] / 1000, 1) . ' km away)' : '') . '</span>';
};
$days = $days ?? [];
$companies = function_exists('hsec_companies') ? hsec_companies() : [];
$monthNav = function (string $tab) use ($month, $company): string {
    $prev = date('Y-m', strtotime($month . '-01 -1 month'));
    $next = date('Y-m', strtotime($month . '-01 +1 month'));
    $q = fn($m) => '/erp/m/attendance?tab=' . $tab . '&amp;month=' . $m . ($company !== '' ? '&amp;company=' . e(urlencode($company)) : '');
    return '<div class="att-month"><a class="btn btn-ghost" href="' . $q($prev) . '">&#8592;</a><b>' . e(date('F Y', strtotime($month . '-01'))) . '</b>'
        . ($next <= date('Y-m') ? '<a class="btn btn-ghost" href="' . $q($next) . '">&#8594;</a>' : '') . '</div>';
};
?>
<header class="page-top">
  <div><h1>Attendance</h1><p class="muted">Working day <?= e($cfg['start']) ?> to <?= e($cfg['end']) ?>. Late after <?= e(date('H:i', strtotime($cfg['start']) + $cfg['grace'] * 60)) ?>. Use the <b>Check in</b> button in the bottom-right corner of any ERP page.</p></div>
</header>
<?php if ($hr): ?>
<nav class="att-tabs">
  <a href="/erp/m/attendance" class="<?= $tab === 'me' ? 'is-on' : '' ?>">My attendance</a>
  <a href="/erp/m/attendance?tab=today" class="<?= $tab === 'today' ? 'is-on' : '' ?>">Team today</a>
  <a href="/erp/m/attendance?tab=month" class="<?= $tab === 'month' ? 'is-on' : '' ?>">Month sheet</a>
  <a href="/erp/m/attendance?tab=requests" class="<?= $tab === 'requests' ? 'is-on' : '' ?>">Requests<?= $pending ? ' <em>' . $pending . '</em>' : '' ?></a>
<?php if ($hr === 'edit'): ?>
  <a href="/erp/m/attendance?tab=settings" class="<?= $tab === 'settings' ? 'is-on' : '' ?>">Settings</a>
<?php endif; ?>
</nav>
<?php endif; ?>
<?php foreach ($errors as $err): ?>
<p class="erp-error"><?= e($err) ?></p>
<?php endforeach; ?>

<?php if ($tab === 'me'): $t = att_totals($days); ?>
<section class="panel">
  <div class="table-head"><h2>My attendance</h2><?= $monthNav('me') ?></div>
  <div class="att-cards">
    <div><b><?= $t['present'] ?></b><span>Days present</span></div>
    <div><b><?= $t['late'] ?></b><span>Late</span></div>
    <div><b><?= $t['absent'] ?></b><span>Absent</span></div>
    <div><b><?= $t['leave'] ?></b><span>Leave</span></div>
    <div><b><?= $t['missed'] ?></b><span>Missed checkout</span></div>
    <div><b><?= number_format($t['hours'], 1) ?></b><span>Hours</span></div>
  </div>
  <div class="table-scroll">
    <table class="data">
      <thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th class="num">Hours</th><th>Where</th></tr></thead>
      <tbody>
<?php foreach (array_reverse($days, true) as $d => $r): if ($r['status'] === 'none') continue; ?>
        <tr>
          <td style="white-space:nowrap"><?= e(date('D j M', strtotime($d))) ?></td>
          <td><?= $st($r['status']) ?><?= $r['late'] && $r['status'] !== 'late' ? ' ' . $st('late') : '' ?><?= $r['note'] ? ' <span class="muted small">' . e($r['note']) . '</span>' : '' ?></td>
          <td><?= e($r['in'] ?? '') ?></td>
          <td><?= e($r['out'] ?? '') ?></td>
          <td class="num"><?= $r['hours'] ? number_format($r['hours'], 1) : '' ?></td>
          <td><?php foreach ($r['punches'] as $p): ?><?= $where($p) ?> <?php endforeach; ?></td>
        </tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>


<section class="panel">
  <h2>Ask for leave or a correction</h2>
  <form method="post" class="form att-req" data-att-req>
    <?= erp_csrf_field() ?>
    <input type="hidden" name="action" value="request">
    <div class="att-kinds">
      <label><input type="radio" name="type" value="correction" checked> I forgot to check in or out</label>
      <label><input type="radio" name="type" value="leave"> Leave</label>
    </div>
    <div class="att-grid" data-for="correction">
      <label>Date<input type="date" name="day" max="<?= date('Y-m-d') ?>"></label>
      <label>Check-in time<input type="time" name="in_time"></label>
      <label>Check-out time<input type="time" name="out_time"></label>
    </div>
    <div class="att-grid" data-for="leave" hidden>
      <label>From<input type="date" name="from"></label>
      <label>To<input type="date" name="to"></label>
      <label>Type<select name="leave_type"><?php foreach (ATT_LEAVE_TYPES as $k => $v): ?><option value="<?= e($k) ?>"><?= e($v) ?></option><?php endforeach; ?></select></label>
    </div>
    <label>Reason<input name="reason" maxlength="500" required placeholder="For example: phone battery died at the site"></label>
    <div><button class="btn" type="submit">Send for approval</button></div>
  </form>
<?php if ($requests): ?>
  <div class="table-scroll" style="margin-top:16px">
    <table class="data">
      <thead><tr><th>Sent</th><th>Request</th><th>Reason</th><th>Status</th><th></th></tr></thead>
      <tbody>
<?php foreach ($requests as $q): ?>
        <tr>
          <td class="muted small"><?= e(date('j M', strtotime($q['created_at']))) ?></td>
          <td><?= $q['type'] === 'leave' ? e(ATT_LEAVE_TYPES[$q['leave_type']] ?? 'Leave') . ', ' . e(date('j M', strtotime($q['day_from']))) . ($q['day_to'] !== $q['day_from'] ? ' to ' . e(date('j M', strtotime($q['day_to']))) : '') : 'Correction for ' . e(date('j M', strtotime($q['day_from']))) . ': ' . e(trim(($q['in_time'] ? 'in ' . $q['in_time'] : '') . ' ' . ($q['out_time'] ? 'out ' . $q['out_time'] : ''))) ?></td>
          <td><?= e($q['reason']) ?></td>
          <td><span class="att-st att-rq-<?= e($q['status']) ?>"><?= e(ucfirst($q['status'])) ?></span></td>
          <td><?php if ($q['status'] === 'pending'): ?><form method="post"><?= erp_csrf_field() ?><input type="hidden" name="action" value="cancel"><input type="hidden" name="id" value="<?= (int) $q['id'] ?>"><button class="linkish" type="submit">Cancel</button></form><?php endif; ?></td>
        </tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
<?php endif; ?>
</section>

<?php elseif ($tab === 'today'): $counts = array_count_values(array_column($days, 'status')); ?>
<section class="panel">
  <div class="table-head"><h2>Team today, <?= e(date('D j M')) ?></h2>
    <form method="get" class="att-filter"><input type="hidden" name="tab" value="today"><?php if ($companies): ?><select name="company" onchange="this.form.submit()"><option value="">All staff</option><?php foreach ($companies as $code => $label): ?><option value="<?= e($code) ?>" <?= $company === $code ? 'selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?></select><?php endif; ?></form></div>
  <div class="att-cards">
    <div><b><?= ($counts['in'] ?? 0) + ($counts['present'] ?? 0) + ($counts['late'] ?? 0) + ($counts['half'] ?? 0) ?></b><span>In today</span></div>
    <div><b><?= count(array_filter($days, fn($r) => $r['late'])) ?></b><span>Late</span></div>
    <div><b><?= ($counts['pending'] ?? 0) + ($counts['absent'] ?? 0) ?></b><span>Not in</span></div>
    <div><b><?= $counts['leave'] ?? 0 ?></b><span>On leave</span></div>
    <div><b><?= count(array_filter($days, fn($r) => $r['offsite'])) ?></b><span>Not at a known site</span></div>
  </div>
  <div class="table-scroll">
    <table class="data att-today">
      <thead><tr><th>Name</th><th>Status</th><th>Check-ins and check-outs</th><th class="num">Hours</th></tr></thead>
      <tbody>
<?php foreach ($people as $u): $r = $days[$u['id']] ?? null; if (!$r) continue; ?>
        <tr class="<?= $r['offsite'] ? 'att-row-flag' : '' ?>">
          <td><b><?= e($u['name']) ?></b></td>
          <td><?= $st($r['status']) ?><?= $r['late'] && $r['status'] !== 'late' ? ' ' . $st('late') : '' ?><?= $r['note'] ? ' <span class="muted small">' . e($r['note']) . '</span>' : '' ?></td>
          <td>
<?php foreach ($r['punches'] as $p): ?>
            <div class="att-punch"><b><?= $p['kind'] === 'in' ? 'In' : 'Out' ?> <?= e(substr($p['at'], 11, 5)) ?></b> <?= $where($p) ?> <?= $map($p) ?><?= $p['ip'] ? ' <span class="muted small">IP ' . e($p['ip']) . '</span>' : '' ?>
              <?php if ($p['photo']): ?><a href="/erp/attendance/api/photo/<?= (int) $p['id'] ?>" target="_blank" rel="noopener"><img class="att-selfie" src="/erp/attendance/api/photo/<?= (int) $p['id'] ?>" alt="Selfie" loading="lazy"></a><?php endif; ?></div>
<?php endforeach; ?>
          </td>
          <td class="num"><?= $r['hours'] ? number_format($r['hours'], 1) : '' ?></td>
        </tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>

<?php elseif ($tab === 'month'): $dates = []; for ($d = $from; $d <= $to; $d = date('Y-m-d', strtotime($d . ' +1 day'))) $dates[] = $d; ?>
<section class="panel">
  <div class="table-head"><h2>Month sheet</h2>
    <div class="att-filter"><?= $monthNav('month') ?>
      <form method="get"><input type="hidden" name="tab" value="month"><input type="hidden" name="month" value="<?= e($month) ?>"><?php if ($companies): ?><select name="company" onchange="this.form.submit()"><option value="">All staff</option><?php foreach ($companies as $code => $label): ?><option value="<?= e($code) ?>" <?= $company === $code ? 'selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?></select><?php endif; ?></form>
      <a class="btn" href="/erp/m/attendance?tab=month&amp;month=<?= e($month) ?>&amp;company=<?= e(urlencode($company)) ?>&amp;csv=1"><?= icon('sheet') ?>Download for payroll (Excel)</a></div></div>
  <p class="muted small">P present · L late · H half day (under <?= e((string) $cfg['half']) ?> hours) · M missed checkout · A absent · LV leave · O weekly off · HO holiday · IN checked in now. A red dot means a check-in away from every saved site.</p>
  <div class="table-scroll">
    <table class="data att-sheet">
      <thead><tr><th>Name</th><th class="num">P</th><th class="num">L</th><th class="num">H</th><th class="num">A</th><th class="num">LV</th><th class="num">M</th><th class="num">Hours</th><?php foreach ($dates as $d): ?><th class="<?= att_workday($d) ? '' : 'att-offday' ?>"><?= e(substr($d, 8)) ?><br><small><?= e(substr(date('D', strtotime($d)), 0, 2)) ?></small></th><?php endforeach; ?></tr></thead>
      <tbody>
<?php foreach ($people as $u): $row = $days[$u['id']] ?? []; $t = att_totals($row); ?>
        <tr>
          <td style="white-space:nowrap"><b><?= e($u['name']) ?></b></td>
          <td class="num"><?= $t['present'] ?></td><td class="num"><?= $t['late'] ?></td><td class="num"><?= $t['half'] ?></td><td class="num"><?= $t['absent'] ?></td><td class="num"><?= $t['leave'] ?></td><td class="num"><?= $t['missed'] ?></td><td class="num"><?= number_format($t['hours'], 1) ?></td>
<?php foreach ($dates as $d): $r = $row[$d] ?? ['status' => 'none', 'in' => null, 'out' => null, 'late' => false, 'offsite' => false, 'note' => '']; ?>
          <td class="att-c att-<?= e($r['status']) ?><?= $r['offsite'] ? ' is-flag' : '' ?>" title="<?= e(date('D j M', strtotime($d)) . ': ' . ATT_STATUS[$r['status']][1] . ($r['in'] ? ', in ' . $r['in'] : '') . ($r['out'] ? ', out ' . $r['out'] : '') . ($r['note'] ? ', ' . $r['note'] : '')) ?>"><?= e(ATT_STATUS[$r['status']][0]) ?></td>
<?php endforeach; ?>
        </tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>

<?php elseif ($tab === 'requests'): ?>
<section class="panel">
  <h2>Leave and correction requests</h2>
  <div class="table-scroll">
    <table class="data">
      <thead><tr><th>Name</th><th>Request</th><th>Reason</th><th>Sent</th><th>Status</th><th></th></tr></thead>
      <tbody>
<?php foreach ($requests as $q): ?>
        <tr>
          <td><b><?= e($names[$q['user_id']] ?? 'Removed user') ?></b></td>
          <td><?= $q['type'] === 'leave' ? e(ATT_LEAVE_TYPES[$q['leave_type']] ?? 'Leave') . ', ' . e(date('j M', strtotime($q['day_from']))) . ($q['day_to'] !== $q['day_from'] ? ' to ' . e(date('j M', strtotime($q['day_to']))) : '') : 'Correction for ' . e(date('D j M', strtotime($q['day_from']))) . ': ' . e(trim(($q['in_time'] ? 'in ' . $q['in_time'] : '') . ' ' . ($q['out_time'] ? 'out ' . $q['out_time'] : ''))) ?></td>
          <td><?= e($q['reason']) ?></td>
          <td class="muted small"><?= e(date('j M, g:i a', strtotime($q['created_at']))) ?></td>
          <td><span class="att-st att-rq-<?= e($q['status']) ?>"><?= e(ucfirst($q['status'])) ?></span><?= $q['decided_by'] ? '<br><span class="muted small">by ' . e($names[$q['decided_by']] ?? '') . '</span>' : '' ?></td>
          <td style="white-space:nowrap"><?php if ($q['status'] === 'pending' && $hr === 'edit'): ?>
            <form method="post" style="display:inline"><?= erp_csrf_field() ?><input type="hidden" name="id" value="<?= (int) $q['id'] ?>"><button class="btn" name="action" value="approve" type="submit">Approve</button> <button class="btn btn-ghost" name="action" value="reject" type="submit">Reject</button></form>
          <?php endif; ?></td>
        </tr>
<?php endforeach; ?>
<?php if (!$requests): ?>
        <tr><td colspan="6" class="muted">No requests yet.</td></tr>
<?php endif; ?>
      </tbody>
    </table>
  </div>
</section>

<?php elseif ($tab === 'settings'): ?>
<section class="panel">
  <h2>Working day and rules</h2>
  <form method="post" class="form">
    <?= erp_csrf_field() ?>
    <input type="hidden" name="action" value="settings">
    <div class="att-grid">
      <label>Day starts<input type="time" name="start" value="<?= e($cfg['start']) ?>"></label>
      <label>Late after (minutes of grace)<input type="number" name="grace" min="0" max="180" value="<?= (int) $cfg['grace'] ?>"></label>
      <label>Day ends (check-out reminder)<input type="time" name="end" value="<?= e($cfg['end']) ?>"></label>
      <label>Missed checkout after<input type="time" name="cutoff" value="<?= e($cfg['cutoff']) ?>"></label>
      <label>Half day if fewer hours than<input type="number" name="half" min="0" max="12" step="0.5" value="<?= e((string) $cfg['half']) ?>"></label>
    </div>
    <fieldset class="att-off"><legend>Weekly off</legend>
<?php foreach (['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as $i => $dn): ?>
      <label><input type="checkbox" name="off[]" value="<?= $i ?>" <?= in_array($i, $cfg['off'], true) ? 'checked' : '' ?>> <?= $dn ?></label>
<?php endforeach; ?>
    </fieldset>
    <label>Public holidays, one per line: date then name
      <textarea name="holidays" rows="5" placeholder="2026-12-25 Quaid-e-Azam Day"><?= e(erp_setting('att_holidays') ?? '') ?></textarea></label>
    <label>Office internet addresses (check-ins from these work even if the phone blocks location)
      <textarea name="ips" rows="3" data-att-ips><?= e(implode("\n", $cfg['ips'])) ?></textarea>
      <span class="muted small">You are on <b><?= e($myIp) ?></b> right now. If you are in the office, <button type="button" class="linkish" data-att-addip="<?= e($myEntry) ?>">add it</button>. If your internet company changes this address from time to time, ask them for a static IP, or this list will need updating.</span></label>
    <div><button class="btn" type="submit">Save settings</button></div>
  </form>
</section>

<section class="panel">
  <h2>Sites</h2>
  <p class="muted">Check-ins away from the office save the exact location. When it falls inside one of these circles it is tagged with the site, otherwise it is flagged "Not at a known site". Nobody is blocked either way.</p>
<?php if ($sites): ?>
  <div class="table-scroll" style="margin-bottom:16px">
    <table class="data">
      <thead><tr><th>Site</th><th>Location</th><th class="num">Radius</th><th></th></tr></thead>
      <tbody>
<?php foreach ($sites as $s): ?>
        <tr><td><b><?= e($s['name']) ?></b></td><td><a href="https://www.google.com/maps?q=<?= e($s['lat'] . ',' . $s['lng']) ?>" target="_blank" rel="noopener"><?= e(round($s['lat'], 5) . ', ' . round($s['lng'], 5)) ?></a></td><td class="num"><?= (int) $s['radius'] ?> m</td>
          <td><form method="post"><?= erp_csrf_field() ?><input type="hidden" name="action" value="site-delete"><input type="hidden" name="id" value="<?= (int) $s['id'] ?>"><button class="linkish" type="submit" onclick="return confirm('Remove this site?')">Remove</button></form></td></tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
<?php endif; ?>
  <form method="post" class="form" data-att-site>
    <?= erp_csrf_field() ?>
    <input type="hidden" name="action" value="site">
    <div class="att-grid">
      <label>Site name<input name="name" maxlength="80" required placeholder="For example: Bahria Town Block C"></label>
      <label>Latitude<input name="lat" required inputmode="decimal" placeholder="31.5204"></label>
      <label>Longitude<input name="lng" required inputmode="decimal" placeholder="74.3587"></label>
      <label>Radius (metres)<input type="number" name="radius" min="50" max="5000" value="300"></label>
    </div>
    <p class="muted small">Standing at the site with your phone? Press <button type="button" class="linkish" data-att-here>Use my location</button>. Or in Google Maps, right-click the place and click the numbers to copy them.</p>
    <div><button class="btn" type="submit">Add site</button></div>
  </form>
</section>
<section class="panel">
  <h2>End-of-day e-mail</h2>
  <p class="muted">At <?= e($cfg['end']) ?>, anyone still checked in gets one e-mail reminder, and the Check out button turns red in the ERP. The e-mail goes out as long as somebody has the ERP open. To send it even when nobody does, add a cron job in cPanel (Advanced, Cron Jobs): every 15 minutes, command <code>php ~/flowsuit-app/erp/cron.php</code>.</p>
  <form method="post"><?= erp_csrf_field() ?><input type="hidden" name="action" value="test-mail"><button class="btn btn-ghost" type="submit">Send a test reminder to me</button></form>
</section>
<?php endif; ?>
