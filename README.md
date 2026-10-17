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

Pages: `/`, `/software`, `/software/{slug}`, `/pricing`, `/contact`, `/sitemap.xml`, `/robots.txt`.

## Adding or editing a product

Edit `app/data/products.json`. Each product gets its own page at `/software/<slug>`, a card in the catalog,
an entry in `sitemap.xml` and `SoftwareApplication` schema automatically. Add `"price_monthly": 9` and
`"currency": "USD"` to a product to include a price in its schema.

The products in the file now are **placeholders**. While `indexable` is `false` in `app/config.php`, every
page tells search engines not to index it. Set it to `true` only once the real products are in.

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
4. After every change merged to `main`: Update from Remote, then Deploy HEAD Commit.
