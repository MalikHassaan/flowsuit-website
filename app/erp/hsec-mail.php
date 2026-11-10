<?php
// E-mailing AMC invoices (hassan, 2026-11-10: "in AMC once the project is created there should be email address of the
// relevant person to whom invoices can be sent through email ... from our system, email should be sent
// customersupport@hsecpak.com ... with the subject of AMC INVOICE FOR THE MONTH OF <month>").
// The browser builds the invoice PDF (the same one "PDF" downloads) and posts it here with the addresses, subject and
// message; this sends it from the HSEC customer support address with the PDF attached and keeps a log.
//
// Settings live only in ~/flowsuit-secrets.php (never in this public code):
//   'hsec_mail_from'   sender address, default customersupport@hsecpak.com
//   'hsec_smtp_host'   the mailbox's outgoing (SMTP) server, e.g. mail.hsecpak.com; without it PHP mail() is used
//   'hsec_smtp_port'   465 (SSL, default) or 587 (STARTTLS)
//   'hsec_smtp_user'   usually the full sender address
//   'hsec_smtp_pass'   the mailbox password
// A copy of every invoice e-mail goes to the sender address (Bcc), so the mailbox keeps a record of what was sent.

const HSEC_MAIL_FROM = 'customersupport@hsecpak.com';

function hsec_mail_log_db(): PDO
{
    $db = hsec_db();
    $db->exec('CREATE TABLE IF NOT EXISTS hsec_mail_log (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, by_user INTEGER, rid TEXT NOT NULL,
        to_addr TEXT NOT NULL, subject TEXT NOT NULL, ok INTEGER NOT NULL, error TEXT)');
    return $db;
}

// "a@x.com, b@y.com; c@z.com" -> valid addresses, or null when any is not an e-mail address
function hsec_mail_list(string $raw): ?array
{
    $out = [];
    foreach (preg_split('/[,;\s]+/', $raw, -1, PREG_SPLIT_NO_EMPTY) as $a) {
        if (!filter_var($a, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n<>"]/', $a)) {
            return null;
        }
        $out[strtolower($a)] = $a;
    }
    return array_values($out);
}

function hsec_amc_mail(array $me): void
{
    if (!erp_can($me, 'hsec', 'edit')) {
        taj_fail(403, 'permission_denied', 'Only people who can edit HSEC ERP can e-mail invoices');
    }
    $rid = (string) ($_POST['rid'] ?? '');
    $st = hsec_db()->prepare("SELECT data FROM hsec_docs WHERE coll = 'receivables' AND id = ? AND data IS NOT NULL");
    $st->execute([$rid]);
    $rec = json_decode((string) $st->fetchColumn(), true);
    if (!is_array($rec) || !hsec_visible(hsec_allowed($me), $rec) || hsec_amc_hidden(hsec_amc_scope($me), 'receivables', $rec)) {
        taj_fail(404, 'not_found', 'That invoice was not found');
    }
    $to = hsec_mail_list((string) ($_POST['to'] ?? ''));
    if (!$to) {
        taj_fail(400, 'bad_address', 'Type a valid e-mail address (several: separate them with a comma)');
    }
    if (count($to) > 10) {
        taj_fail(400, 'bad_address', 'At most 10 addresses per invoice');
    }
    $subject = trim(preg_replace('/[\r\n]+/', ' ', (string) ($_POST['subject'] ?? '')));
    $body = str_replace("\r\n", "\n", (string) ($_POST['body'] ?? ''));
    $fromName = trim(preg_replace('/[\r\n"<>]+/', ' ', (string) ($_POST['from_name'] ?? '')));
    if ($subject === '' || mb_strlen($subject) > 200 || mb_strlen($body) > 8000) {
        taj_fail(400, 'bad_message', 'The subject is missing or the message is too long');
    }
    $f = $_FILES['file'] ?? null;
    if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || $f['size'] > 8 * 1024 * 1024) {
        taj_fail(400, 'bad_file', 'The invoice PDF did not arrive (or is over 8 MB)');
    }
    $pdf = file_get_contents($f['tmp_name']);
    if (strncmp($pdf, '%PDF', 4) !== 0) {
        taj_fail(400, 'bad_file', 'The attachment is not a PDF');
    }
    $name = preg_replace('/[^A-Za-z0-9 ._()-]+/', '-', (string) ($f['name'] ?? 'invoice.pdf'));
    if (!preg_match('/\.pdf$/i', $name)) {
        $name .= '.pdf';
    }
    $from = erp_secret('hsec_mail_from') ?: HSEC_MAIL_FROM;
    $err = hsec_send_mail($from, mb_substr($fromName ?: 'Customer Support', 0, 80), $to, $subject, $body, $name, $pdf);
    hsec_mail_log_db()->prepare('INSERT INTO hsec_mail_log (at, by_user, rid, to_addr, subject, ok, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([gmdate('c'), (int) $me['id'], $rid, implode(', ', $to), $subject, $err === null ? 1 : 0, $err]);
    if ($err !== null) {
        taj_fail(502, 'not_sent', 'The e-mail was not sent: ' . $err);
    }
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'to' => $to, 'from' => $from, 'at' => gmdate('c')]);
    exit;
}

// Returns null when the mail server accepted the message, else the reason.
function hsec_send_mail(string $from, string $fromName, array $to, string $subject, string $body, string $fileName, string $file): ?string
{
    if (function_exists('fs_is_test') && fs_is_test()) {
        $subject = '[TEST SITE] ' . $subject;
    }
    $enc = fn(string $s): string => preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    $b = 'fsb' . bin2hex(random_bytes(12));
    $domain = substr(strrchr($from, '@'), 1);
    $head = 'From: ' . $enc($fromName) . ' <' . $from . ">\r\n"
        . 'To: ' . implode(', ', $to) . "\r\n"
        . 'Subject: ' . $enc($subject) . "\r\n"
        . 'Date: ' . date('r') . "\r\n"
        . 'Message-ID: <' . bin2hex(random_bytes(10)) . '@' . $domain . ">\r\n"
        . "MIME-Version: 1.0\r\n"
        . 'Content-Type: multipart/mixed; boundary="' . $b . '"' . "\r\n";
    $mime = "--$b\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode(str_replace("\n", "\r\n", $body)))
        . "--$b\r\nContent-Type: application/pdf; name=\"$fileName\"\r\nContent-Transfer-Encoding: base64\r\n"
        . "Content-Disposition: attachment; filename=\"$fileName\"\r\n\r\n"
        . chunk_split(base64_encode($file)) . "--$b--\r\n";
    if (erp_secret('erp_mail_log')) {
        // Testing only: copies every e-mail (without the PDF) to flowsuit-data/mail.log.
        file_put_contents(erp_data_dir() . '/mail.log', $head . "\n" . $body . "\n[attachment $fileName, " . strlen($file) . " bytes]\n----\n", FILE_APPEND);
    }
    $host = erp_secret('hsec_smtp_host');
    if (!$host) {
        // No mailbox settings yet: the web server's own mail(). The sender's domain must allow this server (SPF),
        // or receivers may file it as spam.
        $h = preg_replace('/^To: .*\r\n/m', '', preg_replace('/^Subject: .*\r\n/m', '', $head));
        $h .= 'Bcc: ' . $from . "\r\n";
        return @mail(implode(', ', $to), $enc($subject), $mime, $h, '-f' . $from) ? null : 'the web server refused it';
    }
    return hsec_smtp($host, (int) (erp_secret('hsec_smtp_port') ?: 465), (string) erp_secret('hsec_smtp_user') ?: $from,
        (string) erp_secret('hsec_smtp_pass'), $from, array_merge($to, [$from]), $head . "\r\n" . $mime);
}

// Minimal SMTP client: SSL on 465, STARTTLS on any other port, AUTH LOGIN.
function hsec_smtp(string $host, int $port, string $user, string $pass, string $from, array $rcpt, string $data): ?string
{
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true]]);
    $s = @stream_socket_client(($port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port, $no, $msg, 20, STREAM_CLIENT_CONNECT, $ctx);
    if (!$s) {
        return "could not reach the mail server $host:$port ($msg)";
    }
    stream_set_timeout($s, 30);
    $read = function () use ($s): string {
        $all = '';
        while (($l = fgets($s, 1024)) !== false) {
            $all .= $l;
            if (strlen($l) < 4 || $l[3] === ' ') {
                break;
            }
        }
        return $all;
    };
    $cmd = function (string $c, array $ok) use ($s, $read): ?string {
        if ($c !== '') {
            fwrite($s, $c . "\r\n");
        }
        $r = $read();
        return in_array((int) substr($r, 0, 3), $ok, true) ? null : (trim($r) ?: 'no answer');
    };
    $me = preg_replace('/[^a-z0-9.-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost') ?: 'localhost';
    $fail = function (string $step, string $r) use ($s, $pass): string {
        @fwrite($s, "QUIT\r\n");
        fclose($s);
        return 'mail server said at ' . $step . ': ' . str_replace($pass, '***', substr($r, 0, 200));
    };
    if ($e = $cmd('', [220])) {
        return $fail('connect', $e);
    }
    if ($e = $cmd("EHLO $me", [250])) {
        return $fail('EHLO', $e);
    }
    if ($port !== 465) {
        if ($e = $cmd('STARTTLS', [220])) {
            return $fail('STARTTLS', $e);
        }
        if (!stream_socket_enable_crypto($s, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            return $fail('STARTTLS', 'TLS could not start');
        }
        if ($e = $cmd("EHLO $me", [250])) {
            return $fail('EHLO', $e);
        }
    }
    if ($pass !== '') {
        if (($e = $cmd('AUTH LOGIN', [334])) || ($e = $cmd(base64_encode($user), [334])) || ($e = $cmd(base64_encode($pass), [235]))) {
            return $fail('sign-in (check hsec_smtp_user / hsec_smtp_pass)', $e);
        }
    }
    if ($e = $cmd("MAIL FROM:<$from>", [250])) {
        return $fail('MAIL FROM', $e);
    }
    foreach ($rcpt as $r) {
        if ($e = $cmd("RCPT TO:<$r>", [250, 251])) {
            return $fail("RCPT TO $r", $e);
        }
    }
    if ($e = $cmd('DATA', [354])) {
        return $fail('DATA', $e);
    }
    // dot-stuffing: a line starting with "." gets another "."
    if ($e = $cmd(preg_replace('/^\./m', '..', $data) . "\r\n.", [250])) {
        return $fail('sending', $e);
    }
    $cmd('QUIT', [221]);
    fclose($s);
    return null;
}
