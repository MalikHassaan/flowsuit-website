<section class="section">
  <div class="wrap">
    <h1>Pricing</h1>
    <p class="lead">Every business keeps its books differently, so we quote after looking at your workbook. The review is free.</p>
    <div class="grid-2">
      <div class="panel">
        <span class="card-icon"><?= icon('sheet') ?></span>
        <h3>Products</h3>
        <p>Inventory, Finance and Store, set up with your data. Monthly pricing will be announced at launch. Join early access to be first in line.</p>
        <a class="button" href="mailto:<?= e(config('contact_email')) ?>?subject=<?= rawurlencode('Early access') ?>">Get early access</a>
      </div>
      <div class="panel">
        <span class="card-icon"><?= icon('bolt') ?></span>
        <h3>Services</h3>
        <p>Workbook digitization, Google Sheets automation, mobile apps, and websites with SEO. You get a fixed quote per project before any work starts.</p>
        <a class="button" href="mailto:<?= e(config('contact_email')) ?>?subject=<?= rawurlencode('Project quote') ?>">Get a free quote</a>
      </div>
    </div>
  </div>
</section>
