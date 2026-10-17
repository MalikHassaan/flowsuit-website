<section class="hero">
  <h1><?= e(config('tagline')) ?></h1>
  <p>FlowSuit is a growing set of tools for small businesses. Pick the one you need today and add more as you grow.</p>
  <a class="button" href="/software">Browse the software</a>
</section>

<section>
  <h2>Products</h2>
  <div class="cards">
<?php foreach (products() as $p): ?>
    <a class="card" href="/software/<?= e($p['slug']) ?>">
      <span class="badge badge-<?= e($p['status']) ?>"><?= e(status_label($p['status'])) ?></span>
      <h3><?= e($p['name']) ?></h3>
      <p><?= e($p['summary']) ?></p>
    </a>
<?php endforeach; ?>
  </div>
</section>
