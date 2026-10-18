<section class="page-head">
  <div class="wrap">
    <p class="crumbs reveal"><a href="/">Home</a> / Guides</p>
    <h1 class="reveal">Guides</h1>
    <p class="lead reveal">Practical advice on moving from spreadsheets to software, and on getting more out of the sheets you keep.</p>
  </div>
</section>
<section class="section section-tight">
  <div class="wrap grid-3">
<?php foreach (guides() as $g): ?>
    <a class="card guide-card reveal" href="/guides/<?= e($g['slug']) ?>">
      <span class="card-icon"><?= icon($g['icon']) ?></span>
      <h2 class="h3"><?= e($g['title']) ?></h2>
      <p><?= e($g['description']) ?></p>
      <span class="card-meta"><?= e(date('j M Y', strtotime($g['published']))) ?> · <?= (int) $g['read_minutes'] ?> min read</span>
    </a>
<?php endforeach; ?>
  </div>
</section>
