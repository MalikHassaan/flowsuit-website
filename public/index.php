<?php
// Front controller: every request that is not a real file lands here
// (see .htaccess), and the path decides which page to show.

// The app folder sits next to the web root, never inside it.
// Locally that is ../app; on the server it is ~/flowsuit-app (see .cpanel.yml).
$appDir = is_dir(__DIR__ . '/../flowsuit-app') ? __DIR__ . '/../flowsuit-app' : __DIR__ . '/../app';
require $appDir . '/bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// PHP's built-in dev server: let it serve real files such as CSS directly.
if (PHP_SAPI === 'cli-server' && $path !== '/' && is_file(__DIR__ . $path)) {
    return false;
}

// One URL per page: /software/ redirects to /software.
if ($path !== '/' && substr($path, -1) === '/') {
    header('Location: ' . rtrim($path, '/'), true, 301);
    exit;
}

if (!config('indexable')) {
    header('X-Robots-Tag: noindex, nofollow');
}

if ($path === '/') {
    render('home', [
        'title'       => config('site_name') . ' | ' . config('tagline'),
        'description' => 'FlowSuit is a suite of simple business tools: CRM, invoicing, tasks and more, built to work together.',
        'path'        => '/',
    ]);
} elseif ($path === '/software') {
    render('catalog', [
        'title'       => 'All software | ' . config('site_name'),
        'description' => 'Browse every FlowSuit product by category.',
        'path'        => '/software',
    ]);
} elseif (preg_match('#^/software/([a-z0-9-]+)$#', $path, $m) && ($product = product($m[1]))) {
    render('product', [
        'title'       => $product['name'] . ': ' . $product['summary'],
        'description' => $product['description'],
        'path'        => '/software/' . $product['slug'],
        'schema'      => product_schema($product),
    ], ['product' => $product]);
} elseif ($path === '/pricing') {
    render('pricing', [
        'title'       => 'Pricing | ' . config('site_name'),
        'description' => 'FlowSuit pricing plans.',
        'path'        => '/pricing',
    ]);
} elseif ($path === '/contact') {
    render('contact', [
        'title'       => 'Contact | ' . config('site_name'),
        'description' => 'Get in touch with the FlowSuit team.',
        'path'        => '/contact',
    ]);
} elseif ($path === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $paths = ['/', '/software', '/pricing', '/contact'];
    foreach (products() as $p) {
        $paths[] = '/software/' . $p['slug'];
    }
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($paths as $p) {
        echo '  <url><loc>' . e(url($p)) . "</loc></url>\n";
    }
    echo "</urlset>\n";
} elseif ($path === '/robots.txt') {
    header('Content-Type: text/plain; charset=utf-8');
    echo "User-agent: *\n";
    echo config('indexable') ? "Allow: /\n" : "Disallow: /\n";
    echo 'Sitemap: ' . url('/sitemap.xml') . "\n";
} else {
    render('404', [
        'title'       => 'Page not found | ' . config('site_name'),
        'description' => 'This page does not exist.',
        'path'        => $path,
    ], [], 404);
}
