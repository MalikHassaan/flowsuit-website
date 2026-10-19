<?php
// Visitor counts for the public site, kept on our own server: no cookies, no
// third-party script, no IP addresses stored. A visitor is a hash of IP + browser
// + day with a secret salt, so the same person counts once per day and cannot be
// traced back. The report is in the ERP under Website visitors (admins only).

const STATS_EVENTS = ['whatsapp' => 'WhatsApp clicks', 'email' => 'Email clicks', 'chat' => 'Chat opened', 'erp' => 'ERP button clicks'];
const STATS_BOTS = '#bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python|java/|go-http|headless|lighthouse|pingdom|uptime#i';

function stats_db(): PDO
{
    static $db = null;
    if ($db) {
        return $db;
    }
    $dir = dirname(__DIR__) . '/flowsuit-data';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
        file_put_contents($dir . '/.htaccess', "Require all denied\n");
    }
    $db = new PDO('sqlite:' . $dir . '/stats.sqlite');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $db->exec('PRAGMA busy_timeout = 2000');
    $db->exec('CREATE TABLE IF NOT EXISTS hits (day TEXT NOT NULL, path TEXT NOT NULL, visitor TEXT NOT NULL,
        source TEXT NOT NULL, device TEXT NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS hits_day ON hits(day)');
    $db->exec('CREATE TABLE IF NOT EXISTS events (day TEXT NOT NULL, name TEXT NOT NULL, path TEXT NOT NULL, visitor TEXT NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS events_day ON events(day)');
    $db->exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    return $db;
}

function stats_is_bot(): bool
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    return $ua === '' || preg_match(STATS_BOTS, $ua) === 1;
}

function stats_visitor(string $day): string
{
    $db = stats_db();
    $salt = $db->query("SELECT v FROM meta WHERE k = 'salt'")->fetchColumn();
    if (!$salt) {
        $salt = bin2hex(random_bytes(16));
        $db->prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('salt', ?)")->execute([$salt]);
    }
    return substr(hash('sha256', $salt . $day . ($_SERVER['REMOTE_ADDR'] ?? '') . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 16);
}

// Where the visit came from, as a short label: Google, Bing, Facebook, another site's name, or Direct.
function stats_source(): string
{
    $host = strtolower((string) parse_url($_SERVER['HTTP_REFERER'] ?? '', PHP_URL_HOST));
    $own = strtolower((string) parse_url(config('base_url'), PHP_URL_HOST));
    $host = preg_replace('#^(www\.|m\.|l\.|lm\.)#', '', $host);
    if ($host === '' || $host === $own || $host === ($_SERVER['HTTP_HOST'] ?? '')) {
        return 'Direct';
    }
    foreach (['google' => 'Google', 'bing' => 'Bing', 'yahoo' => 'Yahoo', 'duckduckgo' => 'DuckDuckGo', 'facebook' => 'Facebook',
        'instagram' => 'Instagram', 'linkedin' => 'LinkedIn', 'lnkd.in' => 'LinkedIn', 't.co' => 'X (Twitter)', 'whatsapp' => 'WhatsApp',
        'youtube' => 'YouTube', 'chatgpt' => 'ChatGPT', 'perplexity' => 'Perplexity'] as $needle => $label) {
        if (str_contains($host, $needle)) {
            return $label;
        }
    }
    return substr($host, 0, 80);
}

// Counts one page view. Never breaks the page: any database problem is ignored.
function stats_hit(string $path): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || PHP_SAPI === 'cli' || stats_is_bot()) {
        return;
    }
    try {
        $day = date('Y-m-d');
        $device = preg_match('#Mobi|Android|iPhone|iPad#i', $_SERVER['HTTP_USER_AGENT'] ?? '') ? 'Mobile' : 'Desktop';
        stats_db()->prepare('INSERT INTO hits (day, path, visitor, source, device) VALUES (?, ?, ?, ?, ?)')
            ->execute([$day, substr($path, 0, 200), stats_visitor($day), stats_source(), $device]);
        if (random_int(1, 500) === 1) {
            $old = date('Y-m-d', strtotime('-400 days'));
            stats_db()->prepare('DELETE FROM hits WHERE day < ?')->execute([$old]);
            stats_db()->prepare('DELETE FROM events WHERE day < ?')->execute([$old]);
        }
    } catch (Throwable $e) {
        // Counting is optional; the page still shows.
    }
}

// POST /api/event from main.js when someone clicks WhatsApp, email, chat or the ERP button.
function stats_event_handle(): void
{
    http_response_code(204);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || stats_is_bot()) {
        return;
    }
    $in = json_decode((string) file_get_contents('php://input', false, null, 0, 2000), true);
    $name = is_array($in) ? (string) ($in['name'] ?? '') : '';
    $path = is_array($in) ? (string) ($in['path'] ?? '/') : '/';
    if (!isset(STATS_EVENTS[$name]) || !preg_match('#^/[a-z0-9/_-]{0,200}$#', $path)) {
        return;
    }
    try {
        $day = date('Y-m-d');
        $visitor = stats_visitor($day);
        $st = stats_db()->prepare('SELECT COUNT(*) FROM events WHERE day = ? AND name = ? AND visitor = ?');
        $st->execute([$day, $name, $visitor]);
        if ((int) $st->fetchColumn() < 5) {   // stops one person inflating the numbers
            stats_db()->prepare('INSERT INTO events (day, name, path, visitor) VALUES (?, ?, ?, ?)')->execute([$day, $name, $path, $visitor]);
        }
    } catch (Throwable $e) {
    }
}

// Figures for the ERP report: the last $days days, today included.
function stats_report(int $days): array
{
    $db = stats_db();
    $from = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));
    $q = function (string $sql) use ($db, $from): array {
        $st = $db->prepare($sql);
        $st->execute([$from]);
        return $st->fetchAll();
    };
    $daily = [];
    for ($i = $days - 1; $i >= 0; $i--) {
        $daily[date('Y-m-d', strtotime("-$i days"))] = ['visitors' => 0, 'views' => 0];
    }
    foreach ($q('SELECT day, COUNT(DISTINCT visitor) v, COUNT(*) n FROM hits WHERE day >= ? GROUP BY day') as $r) {
        $daily[$r['day']] = ['visitors' => (int) $r['v'], 'views' => (int) $r['n']];
    }
    $events = array_fill_keys(array_keys(STATS_EVENTS), 0);
    foreach ($q('SELECT name, COUNT(*) n FROM events WHERE day >= ? GROUP BY name') as $r) {
        $events[$r['name']] = (int) $r['n'];
    }
    return [
        'visitors' => array_sum(array_column($daily, 'visitors')),
        'views'    => array_sum(array_column($daily, 'views')),
        'daily'    => $daily,
        'events'   => $events,
        'pages'    => $q('SELECT path, COUNT(*) n, COUNT(DISTINCT day || visitor) v FROM hits WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 15'),
        'sources'  => $q('SELECT source, COUNT(DISTINCT day || visitor) v FROM hits WHERE day >= ? GROUP BY source ORDER BY v DESC LIMIT 12'),
        'devices'  => $q('SELECT device, COUNT(DISTINCT day || visitor) v FROM hits WHERE day >= ? GROUP BY device ORDER BY v DESC'),
    ];
}
