<section class="section">
  <div class="wrap">
    <h1><?= e($heading) ?></h1>
    <p class="lead"><?= e($intro) ?></p>
    <div class="grid-3">
<?php foreach ($items as $p) { require __DIR__ . '/card.php'; } ?>
    </div>
  </div>
</section>
