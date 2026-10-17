<section class="page-head">
  <div class="wrap">
    <h1 class="reveal"><?= e($heading) ?></h1>
    <p class="lead reveal"><?= e($intro) ?></p>
  </div>
</section>
<section class="section section-tight">
  <div class="wrap with-sidebar">
<?php require __DIR__ . '/sidebar.php'; ?>
    <div class="grid-2">
<?php foreach ($items as $p) { require __DIR__ . '/card.php'; } ?>
    </div>
  </div>
</section>
