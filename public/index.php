<?php
// Front controller: every request that is not a real file lands here
// (see .htaccess), and the path decides which page to show.

// The app folder sits next to the web root, never inside it.
// Locally that is ../app; on the server it is ~/flowsuit-app (see .cpanel.yml).
$appDir = is_dir(__DIR__ . '/../flowsuit-app') ? __DIR__ . '/../flowsuit-app' : __DIR__ . '/../app';
define('WEB_ROOT', __DIR__);
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

if ($path === '/erp' || strpos($path, '/erp/') === 0) {
    // On Apache, public_html/erp/.htaccess handles these; this branch serves them locally.
    require __DIR__ . '/erp/index.php';
} elseif ($path === '/api/event') {
    stats_event_handle();
} elseif ($path === '/api/chat') {
    require $appDir . '/chat.php';
    chat_handle();
} elseif ($path === '/') {
    render('home', [
        'title'       => 'FlowSuit | ERP, inventory and accounting software in Pakistan',
        'description' => 'FlowSuit turns Excel workbooks, Google Sheets and QuickBooks files into ERP software for inventory, accounts, receivables and sales in Pakistan, plus Google Apps Script automation, mobile apps and SEO.',
        'path'        => '/',
        'schema'      => [
            organization_schema(),
            [
                '@context' => 'https://schema.org',
                '@type'    => 'WebSite',
                'name'     => config('site_name'),
                'url'      => url('/'),
            ],
            faq_schema(home_faqs()),
        ],
    ]);
} elseif ($path === '/software' || strpos($path, '/software/') === 0) {
    // Old URLs from the first version of the site.
    header('Location: ' . substr_replace($path, '/products', 0, strlen('/software')), true, 301);
    exit;
} elseif ($path === '/products') {
    render('catalog', [
        'title'       => 'ERP, inventory, accounting and POS software | ' . config('site_name'),
        'description' => 'FlowSuit ERP, Inventory, Finance and Store replace your inventory, accounting and sales workbooks with shared, secure software for businesses in Pakistan.',
        'path'        => '/products',
        'schema'      => [breadcrumb_schema([['Products', '/products']])],
    ], [
        'heading' => 'Products',
        'intro'   => 'Ready-made software for the workbooks most businesses keep.',
        'items'   => products_of_type('product'),
    ]);
} elseif ($path === '/services') {
    render('catalog', [
        'title'       => 'Excel to web app, Google Apps Script, mobile apps and SEO services | ' . config('site_name'),
        'description' => 'Done-for-you digitization: we turn workbooks into web apps, automate Google Sheets, build mobile apps and websites that rank.',
        'path'        => '/services',
        'schema'      => [breadcrumb_schema([['Services', '/services']])],
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
        'schema'      => [
            product_schema($product),
            breadcrumb_schema([
                [$m[1] === 'services' ? 'Services' : 'Products', '/' . $m[1]],
                [$product['name'], product_path($product)],
            ]),
        ],
    ], ['product' => $product]);
} elseif ($path === '/pricing') {
    // Pricing page was removed; quotes come through the contact page.
    header('Location: /contact', true, 301);
    exit;
} elseif ($path === '/about') {
    render('about', [
        'title'       => 'About FlowSuit: our vision and mission | ' . config('site_name'),
        'description' => 'FlowSuit helps small and growing businesses move from Excel workbooks, Google Sheets and paper registers to secure software for inventory, finance and sales. Read our vision and mission.',
        'path'        => '/about',
        'schema'      => [
            [
                '@context'    => 'https://schema.org',
                '@type'       => 'AboutPage',
                'name'        => 'About FlowSuit',
                'url'         => url('/about'),
                'description' => config('mission'),
                'mainEntity'  => organization_schema(),
            ],
            breadcrumb_schema([['About', '/about']]),
        ],
    ]);
} elseif ($path === '/case-studies') {
    render('case-studies', [
        'title'       => 'Case studies: ERP and recovery software in use | ' . config('site_name'),
        'description' => 'How a real estate developer and a multi-company group moved from Excel exports and QuickBooks to FlowSuit ERP, with per-person access, locked vouchers and live reports.',
        'path'        => '/case-studies',
        'schema'      => [breadcrumb_schema([['Case studies', '/case-studies']])],
    ]);
} elseif ($path === '/guides') {
    render('guides', [
        'title'       => 'Guides: spreadsheets, inventory and accounting software | ' . config('site_name'),
        'description' => 'Practical guides on moving from Excel and Google Sheets to inventory, accounting and ERP software, and on automating the sheets you keep.',
        'path'        => '/guides',
        'schema'      => [breadcrumb_schema([['Guides', '/guides']])],
    ]);
} elseif (preg_match('#^/guides/([a-z0-9-]+)$#', $path, $m) && ($guide = guide($m[1]))) {
    render('guide', [
        'title'       => $guide['title'] . ' | ' . config('site_name'),
        'description' => $guide['description'],
        'path'        => '/guides/' . $guide['slug'],
        'og_type'     => 'article',
        'schema'      => [
            article_schema($guide),
            breadcrumb_schema([['Guides', '/guides'], [$guide['title'], '/guides/' . $guide['slug']]]),
        ],
    ], ['guide' => $guide]);
} elseif ($path === '/contact') {
    render('contact', [
        'title'       => 'Contact FlowSuit: free workbook review and ERP quote',
        'description' => 'Send FlowSuit your Excel workbook, Google Sheet or QuickBooks file for a free review and a fixed quote for ERP, inventory or accounting software.',
        'schema'      => [breadcrumb_schema([['Contact', '/contact']])],
        'path'        => '/contact',
    ]);
} elseif ($path === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    // path => last modified date (null when unknown)
    $mod = fn(string ...$files): string => date('Y-m-d', max(array_map(fn($f) => @filemtime($appDir . '/' . $f) ?: 0, $files)));
    $paths = ['/' => $mod('views/home.php', 'data/products.json'), '/products' => $mod('views/catalog.php', 'data/products.json'),
        '/services' => $mod('views/catalog.php', 'data/products.json'), '/about' => $mod('views/about.php', 'config.php'),
        '/case-studies' => $mod('views/case-studies.php'),
        '/guides' => $mod('views/guides.php', 'data/guides.json'), '/contact' => $mod('views/contact.php')];
    foreach (products() as $p) {
        $paths[product_path($p)] = $mod('views/product.php', 'data/products.json');
    }
    foreach (guides() as $g) {
        $paths['/guides/' . $g['slug']] = $g['updated'] ?? $g['published'];
    }
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($paths as $p => $lastmod) {
        echo '  <url><loc>' . e(url($p)) . '</loc>' . ($lastmod ? '<lastmod>' . e($lastmod) . '</lastmod>' : '') . "</url>\n";
    }
    echo "</urlset>\n";
} elseif ($path === '/robots.txt') {
    header('Content-Type: text/plain; charset=utf-8');
    echo "User-agent: *\n";
    echo config('indexable') ? "Allow: /\nDisallow: /api/\nDisallow: /erp\n" : "Disallow: /\n";
    echo 'Sitemap: ' . url('/sitemap.xml') . "\n";
} else {
    render('404', [
        'title'       => 'Page not found | ' . config('site_name'),
        'description' => 'This page does not exist.',
        'path'        => $path,
    ], [], 404);
}
