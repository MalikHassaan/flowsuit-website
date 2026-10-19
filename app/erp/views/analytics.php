<?php $title = 'Website visitors | FlowSuit ERP'; $active = 'analytics';
$peak = max(1, ...array_column($r['daily'], 'views'));
$total = max(1, array_sum(array_column($r['sources'], 'v')));
$label = fn(string $day) => $days > 90 ? date('M Y', strtotime($day)) : date('j M', strtotime($day)); ?>
<header class="page-top">
  <div><h1>Website visitors</h1><p class="muted">Visits to flowsuit.net, counted on our own server. No cookies, and no IP addresses are kept.</p></div>
  <form method="get" class="range-pick">
    <label>Show <select name="days" onchange="this.form.submit()">
<?php foreach ([7 => 'Last 7 days', 30 => 'Last 30 days', 90 => 'Last 90 days', 365 => 'Last 12 months'] as $d => $text): ?>
      <option value="<?= $d ?>"<?= $d === $days ? ' selected' : '' ?>><?= e($text) ?></option>
<?php endforeach; ?>
    </select></label>
    <noscript><button class="btn" type="submit">Show</button></noscript>
  </form>
</header>

<section class="panel">
  <div class="qb-sum">
    <span>Visitors<b><?= number_format($r['visitors']) ?></b></span>
    <span>Pages viewed<b><?= number_format($r['views']) ?></b></span>
<?php foreach (STATS_EVENTS as $key => $text): ?>
    <span<?= $key === 'whatsapp' || $key === 'email' ? ' class="is-ok"' : '' ?>><?= e($text) ?><b><?= number_format($r['events'][$key]) ?></b></span>
<?php endforeach; ?>
  </div>
  <p class="muted small">A visitor is counted once per day. WhatsApp and email clicks are the closest thing to new leads.</p>
</section>

<section class="panel">
  <h2>Pages viewed per day</h2>
<?php if ($r['views'] === 0): ?>
  <p class="muted">No visits counted yet. Counting starts from the day this page was added.</p>
<?php else: ?>
  <div class="bars" style="--n:<?= count($r['daily']) ?>">
<?php foreach ($r['daily'] as $day => $d): ?>
    <i style="--h:<?= round($d['views'] / $peak * 100, 1) ?>%" title="<?= e(date('D j M Y', strtotime($day))) ?>: <?= $d['views'] ?> pages, <?= $d['visitors'] ?> visitors"></i>
<?php endforeach; ?>
  </div>
  <div class="bars-axis"><span><?= e($label(array_key_first($r['daily']))) ?></span><span><?= e($label(array_key_last($r['daily']))) ?></span></div>
<?php endif; ?>
</section>

<div class="stats-grid">
  <section class="panel">
    <h2>Top pages</h2>
    <table class="data">
      <thead><tr><th>Page</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
      <tbody>
<?php foreach ($r['pages'] as $p): ?>
        <tr><td><a href="<?= e($p['path']) ?>" target="_blank" rel="noopener"><?= e($p['path']) ?></a></td><td class="num"><?= number_format((int) $p['v']) ?></td><td class="num"><?= number_format((int) $p['n']) ?></td></tr>
<?php endforeach; ?>
<?php if (!$r['pages']): ?>
        <tr><td colspan="3" class="muted">Nothing yet.</td></tr>
<?php endif; ?>
      </tbody>
    </table>
  </section>
  <section class="panel">
    <h2>Where visitors came from</h2>
<?php foreach ($r['sources'] as $s): ?>
    <div class="share"><span><?= e($s['source']) ?></span><b><?= number_format((int) $s['v']) ?></b><i style="--w:<?= round($s['v'] / $total * 100, 1) ?>%"></i></div>
<?php endforeach; ?>
<?php if (!$r['sources']): ?>
    <p class="muted">Nothing yet.</p>
<?php endif; ?>
    <h2 class="mt">Devices</h2>
<?php foreach ($r['devices'] as $s): ?>
    <div class="share"><span><?= e($s['device']) ?></span><b><?= number_format((int) $s['v']) ?></b><i style="--w:<?= round($s['v'] / $total * 100, 1) ?>%"></i></div>
<?php endforeach; ?>
    <p class="muted small">Google does not share the words people searched for. Those are in Google Search Console once the site is verified there.</p>
  </section>
</div>
