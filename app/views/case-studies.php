<?php $quote = 'mailto:' . config('contact_email') . '?subject=' . rawurlencode('Digitize my workbook');
// Client names and figures are left out on purpose: both clients' data is confidential.
$cases = [
    [
        'id' => 'real-estate-recovery', 'icon' => 'build', 'tag' => 'Real estate developer',
        'title' => 'Installment recovery for a housing project, live for the whole team',
        'before' => 'Customer payment plans, receipts and bank collections came out of separate systems as Excel exports. Accounts combined them by hand each week, recovery staff kept their own call lists, and management waited for a consolidated sheet before they could see how much was overdue.',
        'built' => [
            'Receipts against dues for every customer and for the whole project',
            'Number of installments paid and the percentage of price received',
            'Bank collection by day and bank, matched to customers',
            'A recovery desk with follow-up notes and history per customer',
            'Per-person logins: management views, accounts upload, admin sees the audit trail',
            'Daily backups the client downloads and keeps',
        ],
        'after' => 'Accounts upload the latest exports and every screen updates for everyone at once. Management reads the same numbers as the accounts team, without waiting for a weekly sheet, and recovery staff work from one shared list.',
        'links' => [['/guides/installment-recovery-tracking', 'Guide: installment recovery tracking'], ['/products/erp', 'FlowSuit ERP']],
    ],
    [
        'id' => 'group-finance-erp', 'icon' => 'ledger', 'tag' => 'Multi-company group',
        'title' => 'From QuickBooks to one finance ERP for several companies',
        'before' => 'Each company kept its books in its own QuickBooks file, and the financial statements were rebuilt in spreadsheets every period. Nobody could see the whole group in one place, and a posted entry could still be changed without a trace.',
        'built' => [
            'One chart of accounts designed for the financial statements',
            'Separate books per company, with a switch between them',
            'Bank, cash, journal and sales vouchers that lock once posted',
            'QuickBooks Journal import per company, with a check page and saved account matches',
            'View-only and editing roles, and an append-only change history',
            'Trial balance and statements straight from the posted vouchers',
        ],
        'after' => 'Years of QuickBooks history came across per company, checked against the QuickBooks totals before anything was saved. Posted vouchers can no longer be edited, and every change is recorded with who made it and when.',
        'links' => [['/guides/quickbooks-to-erp', 'Guide: moving from QuickBooks to an ERP'], ['/products/finance', 'FlowSuit Finance']],
    ],
]; ?>
<section class="hero about-hero">
  <div class="hero-bg" aria-hidden="true"><span class="blob blob-1"></span><span class="blob blob-2"></span><span class="grid-lines"></span></div>
  <div class="wrap narrow">
    <p class="crumbs anim-up"><a href="/">Home</a> / Case studies</p>
    <p class="eyebrow anim-up d1">Case studies</p>
    <h1 class="anim-up d2">Real businesses, <span class="text-gradient">running on FlowSuit today.</span></h1>
    <p class="lead anim-up d3">Two systems we built from the files our clients already had. Client names and figures are kept private, because their data is confidential.</p>
  </div>
</section>

<?php foreach ($cases as $i => $c): ?>
<section class="section<?= $i % 2 ? ' section-soft' : '' ?>" id="<?= e($c['id']) ?>">
  <div class="wrap">
    <article class="case">
      <header class="case-head reveal">
        <span class="card-icon"><?= icon($c['icon']) ?></span>
        <p class="eyebrow"><?= e($c['tag']) ?></p>
        <h2><?= e($c['title']) ?></h2>
      </header>
      <div class="case-grid">
        <div class="case-block reveal">
          <h3>Before</h3>
          <p><?= e($c['before']) ?></p>
          <h3>After</h3>
          <p><?= e($c['after']) ?></p>
          <p class="case-links">
<?php foreach ($c['links'] as [$href, $text]): ?>
            <a href="<?= e($href) ?>"><?= e($text) ?> <?= icon('arrow') ?></a>
<?php endforeach; ?>
          </p>
        </div>
        <div class="case-block case-built reveal">
          <h3>What we built</h3>
          <ul class="ticks">
<?php foreach ($c['built'] as $item): ?>
            <li><?= icon('check') ?><?= e($item) ?></li>
<?php endforeach; ?>
          </ul>
        </div>
      </div>
    </article>
  </div>
</section>
<?php endforeach; ?>

<section class="cta-band">
  <div class="wrap">
    <h2 class="reveal">Your workbook could be the next one.</h2>
    <a class="button button-light reveal" href="<?= e($quote) ?>">Get a free review <?= icon('arrow') ?></a>
  </div>
</section>
