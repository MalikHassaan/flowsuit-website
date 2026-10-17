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

// One URL per page: /products/ redirects to /products.
if ($path !== '/' && substr($path, -1) === '/') {
    header('Location: ' . rtrim($path, '/'), true, 301);
    exit;
}

if (!config('indexable')) {
    header('X-Robots-Tag: noindex, nofollow');
}

if ($path === '/') {
    render('home', [
        'title'       => config('site_name') . ' | Workbook, inventory and accounting digitization',
        'description' => 'FlowSuit turns Excel workbooks, Google Sheets and paper registers into business software for inventory, finance and sales, plus Google Apps Script automation, mobile apps and SEO.',
        'path'        => '/',
        'schema'      => [
            '@context' => 'https://schema.org',
            '@type'    => 'Organization',
            'name'     => config('site_name'),
            'url'      => url('/'),
            'email'    => config('contact_email'),
        ],
    ]);
} elseif ($path === '/software' || strpos($path, '/software/') === 0) {
    // Old URLs from the first version of the site.
    header('Location: ' . substr_replace($path, '/products', 0, strlen('/software')), true, 301);
    exit;
} elseif ($path === '/products') {
    render('catalog', [
        'title'       => 'Products: inventory, finance and store | ' . config('site_name'),
        'description' => 'FlowSuit products replace your inventory, accounting and sales workbooks with shared, secure software.',
        'path'        => '/products',
    ], [
        'heading' => 'Products',
        'intro'   => 'Ready-made software for the workbooks most businesses keep.',
        'items'   => products_of_type('product'),
    ]);
} elseif ($path === '/services') {
    render('catalog', [
        'title'       => 'Services: workbook digitization, Apps Script, mobile apps, SEO | ' . config('site_name'),
        'description' => 'Done-for-you digitization: we turn workbooks into web apps, automate Google Sheets, build mobile apps and websites that rank.',
        'path'        => '/services',
    ], [
        'heading' => 'Services',
        'intro'   => 'Our team builds it for you, with a fixed quote up front.',
        'items'   => products_of_type('service'),
    ]);
} elseif (preg_match('#^/(products|services)/([a-z0-9-]+)$#', $path, $m)
    && ($product = product($m[2], $m[1] === 'services' ? 'service' : 'product'))) {
    render('product', [
        'title'       => $product['name'] . ': ' . $product['summary'],
        'description' => $product['description'],
        'path'        => product_path($product),
        'schema'      => product_schema($product),
    ], ['product' => $product]);
} elseif ($path === '/pricing') {
    render('pricing', [
        'title'       => 'Pricing | ' . config('site_name'),
        'description' => 'How FlowSuit pricing works for products and services. Free workbook review.',
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
    $paths = ['/', '/products', '/services', '/pricing', '/contact'];
    foreach (products() as $p) {
        $paths[] = product_path($p);
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
