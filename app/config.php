<?php
// Site-wide settings. Edit these, commit, and redeploy.
// Never put passwords or API keys in this file: the repository is public.

return [
    'site_name'   => 'FlowSuit',
    'tagline'     => 'Turn your workbooks into business software.',
    'base_url'    => 'https://flowsuit.net',   // no trailing slash
    'contact_email' => 'hello@flowsuit.net',   // create this mailbox in GoDaddy first

    // Keep this false while the products are placeholders. When false, every page
    // sends "noindex" and robots.txt blocks crawlers, so Google does not index
    // fake content. Set to true once the real products are in products.json.
    'indexable'   => false,
];
