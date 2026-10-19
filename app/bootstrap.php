<?php
// Shared helpers used by the front controller and the views.

$config = require __DIR__ . '/config.php';
require_once __DIR__ . '/analytics.php';

function config(string $key)
{
    global $config;
    return $config[$key] ?? null;
}

// Escape text for HTML output.
function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function url(string $path = '/'): string
{
    return rtrim(config('base_url'), '/') . $path;
}

// wa.me link that opens WhatsApp with a ready-made first message, or null when no number is set.
function whatsapp_url(?string $message = null): ?string
{
    $number = preg_replace('/\D/', '', (string) config('whatsapp_number'));
    return $number === '' ? null : 'https://wa.me/' . $number . '?text=' . rawurlencode($message ?? (string) config('whatsapp_message'));
}

// All products from the registry, in file order.
function products(): array
{
    static $products = null;
    if ($products === null) {
        $json = file_get_contents(__DIR__ . '/data/products.json');
        $products = json_decode($json, true)['products'] ?? [];
    }
    return $products;
}

function product(string $slug, string $type): ?array
{
    foreach (products() as $product) {
        if ($product['slug'] === $slug && $product['type'] === $type) {
            return $product;
        }
    }
    return null;
}

// Our software products (type "product") or done-for-you services (type "service").
function products_of_type(string $type): array
{
    return array_values(array_filter(products(), fn($p) => $p['type'] === $type));
}

// Public path of a product or service page.
function product_path(array $product): string
{
    return ($product['type'] === 'service' ? '/services/' : '/products/') . $product['slug'];
}

// Render a view inside the shared layout.
// $page: title, description, path (for the canonical tag), optional schema (array).
function render(string $view, array $page, array $data = [], int $status = 200): void
{
    http_response_code($status);
    extract($data);
    ob_start();
    require __DIR__ . '/views/' . $view . '.php';
    $content = ob_get_clean();
    require __DIR__ . '/views/layout.php';
    if ($status === 200) {
        stats_hit($page['path']);
    }
}

// JSON-LD for a product (SoftwareApplication) or service (Service) page. Only real
// data goes in here: no invented ratings or reviews, which Google treats as spam.
function product_schema(array $product): array
{
    $publisher = ['@type' => 'Organization', 'name' => config('site_name'), 'url' => url('/')];
    if ($product['type'] === 'service') {
        return [
            '@context'    => 'https://schema.org',
            '@type'       => 'Service',
            'name'        => $product['name'],
            'description' => $product['description'],
            'url'         => url(product_path($product)),
            'provider'    => $publisher,
        ];
    }
    $schema = [
        '@context'            => 'https://schema.org',
        '@type'               => 'SoftwareApplication',
        'name'                => $product['name'],
        'description'         => $product['description'],
        'applicationCategory' => $product['schema_category'] ?? 'BusinessApplication',
        'operatingSystem'     => $product['operating_system'] ?? 'Web browser',
        'url'                 => url(product_path($product)),
        'publisher'           => $publisher,
    ];
    if (isset($product['price_monthly'])) {
        $schema['offers'] = [
            '@type'         => 'Offer',
            'price'         => (string) $product['price_monthly'],
            'priceCurrency' => $product['currency'] ?? 'USD',
        ];
    }
    return $schema;
}

// BreadcrumbList JSON-LD from [name, path] pairs, home first.
function breadcrumb_schema(array $trail): array
{
    $items = [];
    foreach (array_merge([['Home', '/']], $trail) as $i => [$name, $path]) {
        $items[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $name, 'item' => url($path)];
    }
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items];
}

// FAQPage JSON-LD from [question => answer]. Only for questions shown on the same page.
function faq_schema(array $faqs): array
{
    $entities = [];
    foreach ($faqs as $q => $a) {
        $entities[] = ['@type' => 'Question', 'name' => $q, 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $a]];
    }
    return ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => $entities];
}

// Guides (articles) from the registry, newest first. Each body is views/guides/<slug>.php.
function guides(): array
{
    static $guides = null;
    if ($guides === null) {
        $json = file_get_contents(__DIR__ . '/data/guides.json');
        $guides = json_decode($json, true)['guides'] ?? [];
        usort($guides, fn($a, $b) => strcmp($b['published'], $a['published']));
    }
    return $guides;
}

function guide(string $slug): ?array
{
    foreach (guides() as $guide) {
        if ($guide['slug'] === $slug) {
            return $guide;
        }
    }
    return null;
}

function article_schema(array $guide): array
{
    $org = ['@type' => 'Organization', 'name' => config('site_name'), 'url' => url('/'),
            'logo' => ['@type' => 'ImageObject', 'url' => url('/assets/logo/flowsuit-mark-512.png')]];
    return [
        '@context'         => 'https://schema.org',
        '@type'            => 'Article',
        'headline'         => $guide['title'],
        'description'      => $guide['description'],
        'datePublished'    => $guide['published'],
        'dateModified'     => $guide['updated'] ?? $guide['published'],
        'mainEntityOfPage' => url('/guides/' . $guide['slug']),
        'image'            => url('/assets/og-image.png'),
        'author'           => $org,
        'publisher'        => $org,
    ];
}

// FAQs shown on the home page (also used for its FAQPage schema).
function home_faqs(): array
{
    return [
        'Do I lose my existing data?' => 'No. We move the data from your current workbook into FlowSuit as part of the project.',
        'Can I keep using Google Sheets?' => 'Yes. If your team prefers Sheets, we can automate it with Google Apps Script instead of replacing it.',
        'Does it work on mobile?' => 'Yes. FlowSuit works in a phone browser, and we also build Android and iPhone apps.',
        'How much does it cost?' => 'It depends on the size of your workbook and process. Send it to us for a free review and a fixed quote.',
        'How long does a workbook take to digitize?' => 'Most single workbooks take two to six weeks, depending on how many sheets, formulas and users are involved. You get a timeline with the fixed quote.',
        'Is my data safe?' => 'Each staff member gets their own login and only sees what their role allows. Every change is recorded, and data is backed up daily.',
    ];
}

// Inline SVG icon by name (see views/icons.php).
function icon(string $name): string
{
    static $icons = null;
    $icons ??= require __DIR__ . '/views/icons.php';
    return $icons[$name] ?? '';
}

function organization_schema(): array
{
    return [
        '@context'    => 'https://schema.org',
        '@type'       => 'Organization',
        'name'        => config('site_name'),
        'url'         => url('/'),
        'logo'        => url('/assets/logo/flowsuit-mark-512.png'),
        'email'       => config('contact_email'),
        'slogan'      => config('tagline'),
        'description' => config('mission'),
        'knowsAbout'  => ['ERP software', 'Inventory management software', 'Accounting software', 'QuickBooks migration', 'Receivables and recovery tracking', 'Spreadsheet digitization', 'Google Apps Script', 'Mobile apps', 'SEO'],
        'areaServed'  => ['@type' => 'Country', 'name' => 'Pakistan'],
        'contactPoint' => ['@type' => 'ContactPoint', 'contactType' => 'sales', 'email' => config('contact_email'), 'availableLanguage' => ['English', 'Urdu']],
    ];
}

// The header logo, inlined so its parts can animate (see .logo-anim in style.css).
function logo_svg(): string
{
    static $svg = null;
    if ($svg === null) {
        $svg = @file_get_contents(WEB_ROOT . '/assets/logo/flowsuit-logo.svg');
        if ($svg === false) {
            return $svg = '<img src="/assets/logo/flowsuit-logo.svg" alt="" width="152" height="36">';
        }
        $svg = preg_replace('#<title>.*?</title>#s', '', $svg);
        $svg = str_replace(['<svg ', 'id="fs-g"', 'url(#fs-g)'], ['<svg width="152" height="36" aria-hidden="true" ', 'id="fs-g-head"', 'url(#fs-g-head)'], $svg);
    }
    return $svg;
}
