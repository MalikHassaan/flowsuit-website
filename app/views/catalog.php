<h1>All software</h1>
<?php foreach (products_by_category() as $category => $items): ?>
<section>
  <h2><?= e($category) ?></h2>
  <div class="cards">
<?php foreach ($items as $p): ?>
    <a class="card" href="/software/<?= e($p['slug']) ?>">
      <span class="badge badge-<?= e($p['status']) ?>"><?= e(status_label($p['status'])) ?></span>
      <h3><?= e($p['name']) ?></h3>
      <p><?= e($p['summary']) ?></p>
    </a>
<?php endforeach; ?>
  </div>
</section>
<?php endforeach; ?>
