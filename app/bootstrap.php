<?php
// Shared helpers used by the front controller and the views.

$config = require __DIR__ . '/config.php';

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

function product(string $slug): ?array
{
    foreach (products() as $product) {
        if ($product['slug'] === $slug) {
            return $product;
        }
    }
    return null;
}

// Products grouped by category name, for the catalog page.
function products_by_category(): array
{
    $groups = [];
    foreach (products() as $product) {
        $groups[$product['category']][] = $product;
    }
    return $groups;
}

function status_label(string $status): string
{
    return [
        'live'        => 'Available',
        'beta'        => 'Beta',
        'coming-soon' => 'Coming soon',
    ][$status] ?? ucfirst($status);
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
}

// SoftwareApplication JSON-LD for a product page. Only real data goes in here:
// no invented ratings or reviews, which Google treats as spam.
function product_schema(array $product): array
{
    $schema = [
        '@context'            => 'https://schema.org',
        '@type'               => 'SoftwareApplication',
        'name'                => $product['name'],
        'description'         => $product['description'],
        'applicationCategory' => $product['schema_category'] ?? 'BusinessApplication',
        'operatingSystem'     => $product['operating_system'] ?? 'Web browser',
        'url'                 => url('/software/' . $product['slug']),
        'publisher'           => ['@type' => 'Organization', 'name' => config('site_name'), 'url' => url('/')],
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
