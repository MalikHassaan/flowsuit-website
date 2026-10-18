<?php
// Entry point for flowsuit.net/erp. On the server this file sits in ~/public_html/erp;
// the app code lives in ~/flowsuit-app (locally: ../../app).
$appDir = is_dir(__DIR__ . '/../../flowsuit-app') ? __DIR__ . '/../../flowsuit-app' : __DIR__ . '/../../app';
if (!defined('WEB_ROOT')) {
    define('WEB_ROOT', dirname(__DIR__));
}
require_once $appDir . '/bootstrap.php';
require_once $appDir . '/erp/erp.php';

erp_handle(parse_url($_SERVER['REQUEST_URI'] ?? '/erp', PHP_URL_PATH) ?: '/erp');
