<?php $others = array_filter(guides(), fn($g) => $g['slug'] !== $guide['slug']); ?>
<section class="page-head">
  <div class="wrap narrow">
    <p class="crumbs reveal"><a href="/">Home</a> / <a href="/guides">Guides</a></p>
    <h1 class="reveal"><?= e($guide['title']) ?></h1>
    <p class="lead reveal"><?= e($guide['description']) ?></p>
    <p class="article-meta reveal">By the FlowSuit team · <time datetime="<?= e($guide['published']) ?>"><?= e(date('j F Y', strtotime($guide['published']))) ?></time> · <?= (int) $guide['read_minutes'] ?> min read</p>
  </div>
</section>
<article class="section section-tight">
  <div class="wrap narrow prose">
<?php require __DIR__ . '/guides/' . $guide['slug'] . '.php'; ?>
  </div>
</article>
<section class="section section-soft">
  <div class="wrap narrow">
    <div class="inline-cta reveal">
      <div>
        <h2>Want us to look at your workbook?</h2>
        <p>Send it over. We will tell you what to automate and what to replace, free of charge.</p>
      </div>
      <a class="button" href="<?= e('mailto:' . config('contact_email') . '?subject=' . rawurlencode('Workbook review')) ?>">Get a free review <?= icon('arrow') ?></a>
    </div>
    <h2 class="reveal">More guides</h2>
    <div class="grid-2">
<?php foreach ($others as $g): ?>
      <a class="card guide-card reveal" href="/guides/<?= e($g['slug']) ?>">
        <span class="card-icon"><?= icon($g['icon']) ?></span>
        <h3><?= e($g['title']) ?></h3>
        <span class="card-meta"><?= (int) $g['read_minutes'] ?> min read</span>
      </a>
<?php endforeach; ?>
    </div>
  </div>
</section>
