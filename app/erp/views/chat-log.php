<?php $title = 'Chat log | FlowSuit ERP'; $active = 'chat-log'; ?>
<?php if (isset($room)): ?>
<header class="page-top">
  <div><h1><?= e($roomTitle) ?></h1><p class="muted"><?= ['group' => 'Group', 'system' => 'Automatic messages'][$room['kind']] ?? 'One-to-one chat' ?> · <?= e(implode(', ', $members)) ?> · <?= count($msgs) ?> messages, deleted ones included.</p></div>
  <div><a class="btn btn-ghost" href="/erp/chat-log">All conversations</a> <a class="btn" href="/erp/chat-log?room=<?= (int) $room['id'] ?>&amp;csv=1"><?= icon('sheet') ?>Download as Excel (CSV)</a></div>
</header>
<section class="panel">
  <div class="table-scroll">
    <table class="data">
      <thead><tr><th>Sent</th><th>From</th><th>Message</th><th>File</th><th></th></tr></thead>
      <tbody>
<?php foreach ($msgs as $m): ?>
        <tr class="<?= $m['deleted_at'] ? 'is-off' : '' ?>">
          <td class="muted small" style="white-space:nowrap"><?= e(date('j M Y, g:i a', strtotime($m['at']))) ?></td>
          <td><b><?= e($m['name']) ?></b></td>
          <td style="white-space:pre-wrap"><?= e($m['body']) ?></td>
          <td><?php if ($m['file']): ?><a href="/erp/chat/api/file/<?= (int) $m['file']['id'] ?>?dl=1"><?= e($m['file']['name']) ?></a> <span class="muted small"><?= e(number_format($m['file']['size'] / 1024)) ?> KB</span><?php endif; ?></td>
          <td><?= $m['deleted_at'] ? '<span class="tag">Deleted ' . e(date('j M, g:i a', strtotime($m['deleted_at']))) . '</span>' : '' ?></td>
        </tr>
<?php endforeach; ?>
<?php if (!$msgs): ?>
        <tr><td colspan="5" class="muted">No messages yet.</td></tr>
<?php endif; ?>
      </tbody>
    </table>
  </div>
</section>
<?php else: ?>
<header class="page-top">
  <div><h1>Chat log</h1><p class="muted">Every staff conversation, including messages people deleted. Only admins can open this page.</p></div>
</header>
<section class="panel">
  <div class="table-scroll">
    <table class="data">
      <thead><tr><th>Conversation</th><th>People</th><th>Messages</th><th>Last message</th><th></th></tr></thead>
      <tbody>
<?php foreach ($rooms as $r): ?>
        <tr>
          <td><b><?= $r['kind'] === 'dm' ? 'One-to-one' : e($r['name']) ?></b></td>
          <td><?= e(implode(', ', $r['members'])) ?></td>
          <td><?= (int) $r['n'] ?></td>
          <td class="muted small"><?= $r['last_at'] ? e(date('j M Y, g:i a', strtotime($r['last_at']))) : 'None yet' ?></td>
          <td><a href="/erp/chat-log?room=<?= (int) $r['id'] ?>">Read</a></td>
        </tr>
<?php endforeach; ?>
<?php if (!$rooms): ?>
        <tr><td colspan="5" class="muted">Nobody has chatted yet. The chat button is in the bottom-right corner of every ERP page.</td></tr>
<?php endif; ?>
      </tbody>
    </table>
  </div>
</section>
<?php endif; ?>
