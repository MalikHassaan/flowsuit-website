# FlowSuit website

Marketing site for [flowsuit.net](https://flowsuit.net). Plain PHP, no framework, no build step.

## How it is organised

```
public/              -> copied to ~/public_html (what visitors can reach)
  index.php          front controller: decides which page to show from the URL
  .htaccess          clean URLs, www -> non-www, optional HTTPS redirect
  assets/            CSS and favicon
app/                 -> copied to ~/flowsuit-app (outside the web root)
  config.php         site name, base URL, contact email, indexable switch
  bootstrap.php      helpers (product lookup, schema, rendering)
  data/products.json the product registry
  views/             one PHP template per page
.cpanel.yml          deploy instructions for cPanel Git Version Control
```

Pages: `/`, `/products`, `/products/{slug}`, `/services`, `/services/{slug}`, `/about`, `/guides`, `/guides/{slug}`, `/contact` (`/pricing` redirects to `/contact`), `/sitemap.xml`, `/robots.txt`.

## Adding or editing a product or service

Edit `app/data/products.json`. Items with `"type": "product"` get a page at `/products/<slug>` with
`SoftwareApplication` schema; items with `"type": "service"` get a page at `/services/<slug>` with `Service`
schema. Both get a card, a footer link and a `sitemap.xml` entry automatically. `icon` is a name from
`app/views/icons.php`. Add `"price_monthly": 9` and
`"currency": "USD"` to a product to include a price in its schema.

Review the copy before going public. While `indexable` is `false` in `app/config.php`, every
page tells search engines not to index it. Set it to `true` only once the real products are in.

## Reserved for the app: /erp

`flowsuit.net/erp` is kept free for the FlowSuit app that customers will log in to. `.htaccess` sends
`/erp` straight to the `public_html/erp` folder instead of this site, so the app can be deployed there
separately without touching the marketing site.

## Run it on your computer

```
php -S localhost:8000 -t public public/index.php
```

Then open http://localhost:8000.

## Deploy on GoDaddy cPanel

Use cPanel's **Git Version Control**. Do not use GoDaddy's Node.js deploy screen; this site is PHP.

1. cPanel -> Git Version Control -> Create. Clone URL `https://github.com/MalikHassaan/flowsuit-website.git`,
   repository path `repositories/flowsuit-website`. Click Create.
2. Open Manage -> Pull or Deploy -> Update from Remote, then Deploy HEAD Commit.
   `.cpanel.yml` copies `public/` into `public_html` and `app/` into `~/flowsuit-app`.
3. In File Manager, delete GoDaddy's default `index.html` / `default.html` from `public_html` if present.
4. After every change merged to `main`: Update from Remote, then Deploy HEAD Commit, or let the cron job below do it.

### Automatic deploys

`.github/workflows/deploy.yml` uploads `app/` to `~/flowsuit-app` and `public/` to `~/public_html` over FTP
every time `main` changes, usually within a minute or two. It needs three repository secrets
(GitHub -> Settings -> Secrets and variables -> Actions): `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`.
Until they are set the workflow does nothing.

`deploy.sh` is a manual fallback that pulls `main` in the cPanel Git checkout and copies it into place.

### Website chat assistant

The chat bubble on every page posts to `/api/chat` (`app/chat.php`). It answers with Claude when an
Anthropic API key is set on the server, and from the FAQ and product list when it is not.

The key never goes in this repository. On the server, create `~/flowsuit-secrets.php` (next to
`public_html`, not inside it) with:

```php
<?php
return ['anthropic_api_key' => 'sk-ant-...'];
```

Model and per-visitor hourly limit are in `app/config.php`. The deploy workflow runs
`composer install` in `app/` so the Claude PHP SDK (`app/vendor/`) ships with each release.

## FlowSuit ERP (flowsuit.net/erp)

A signed-in area for customers. Code: `public/erp/` (entry point) and `app/erp/` (logic and views).

- Data is stored in `~/flowsuit-data/erp.sqlite` on the server, outside the web root and outside this repository. Back it up from cPanel File Manager.
- First run: add `'erp_setup_code' => 'a-long-secret',` to `~/flowsuit-secrets.php`, open `/erp`, and create the first admin with that code. The setup page closes once an admin exists.
- Admins add users under **Users and access** and give each person "No access", "View only" or "View and upload" per module.
- **TAJ Receivables** shows the TAJ dashboard file that an admin uploads inside the ERP. It is stored at `~/flowsuit-data/modules/taj-receivables.html` and is never committed here. Inside it, admins and "View and upload" users can load new exports, "View only" users can read and export PDFs, and its sign-out button returns to the ERP. The file is built in the "BI reporting" project (`bi-reporting/source`, `node build-erp.js`) and contains real customer data, so it must never be added to this public repository.
- **Reports** accepts any `.xlsx` or `.csv` export and shows totals, aging and the biggest balances.
