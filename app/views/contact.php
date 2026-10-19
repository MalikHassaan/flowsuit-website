<section class="section">
  <div class="wrap narrow">
    <h1>Contact</h1>
    <p class="lead">Tell us what your workbook does today, and attach it if you can. We reply with a free review and next steps.</p>
    <p class="actions">
      <a class="button" href="mailto:<?= e(config('contact_email')) ?>?subject=<?= rawurlencode('Digitize my workbook') ?>" data-track="email"><?= icon('mail') ?><?= e(config('contact_email')) ?></a>
<?php if ($wa = whatsapp_url()): ?>
      <a class="button button-wa" href="<?= e($wa) ?>" target="_blank" rel="noopener" data-track="whatsapp"><?= icon('whatsapp') ?>Message us on WhatsApp</a>
<?php endif; ?>
    </p>
  </div>
</section>
