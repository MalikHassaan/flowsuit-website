<?php $title = 'AI assistant | FlowSuit ERP'; $active = 'help-notes'; ?>
<header class="page-top">
  <div><h1>AI assistant</h1><p class="muted">The orange <b>?</b> button on every page answers "how do I…" questions about the system it is in, and nothing else. It sees the menu and the labels on the screen, never the figures.</p></div>
</header>
<?php if (!$on): ?>
<p class="erp-error">Switched off: the server has no Anthropic API key. Add <code>'anthropic_api_key' => '…'</code> to <code>flowsuit-secrets.php</code> in your home folder (cPanel File Manager), outside public_html. Never paste the key in chat or on GitHub.</p>
<?php endif; ?>
<section class="panel">
  <h2>Your company's rules for the assistant</h2>
  <p class="muted">Optional. Write how your company does things, and the assistant will follow it. For example: "Vouchers above 1,000,000 need approval from the CFO." or "Site engineers enter cash advances under Financials, Cash advances."</p>
  <form method="post" class="form">
    <?= erp_csrf_field() ?>
<?php foreach (HELP_SYSTEMS as $k => $s): ?>
    <label><?= e($s['name']) ?><textarea name="<?= e($k) ?>" rows="5" maxlength="8000"><?= e($notes[$k]) ?></textarea></label>
<?php endforeach; ?>
    <div><button class="btn" type="submit">Save</button></div>
  </form>
</section>
