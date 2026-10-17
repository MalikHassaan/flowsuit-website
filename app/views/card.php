<a class="card" href="<?= e(product_path($p)) ?>">
  <span class="card-icon"><?= icon($p['icon']) ?></span>
  <span class="badge badge-<?= e($p['status']) ?>"><?= e(status_label($p['status'])) ?></span>
  <h3><?= e($p['name']) ?></h3>
  <p><?= e($p['summary']) ?></p>
  <span class="card-link">Learn more <?= icon('arrow') ?></span>
</a>
