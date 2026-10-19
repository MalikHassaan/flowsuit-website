<?php
// Site-wide settings. Edit these, commit, and redeploy.
// Never put passwords or API keys in this file: the repository is public.

return [
    'site_name'   => 'FlowSuit',
    'tagline'     => 'Turn your workbooks into business software.',
    'vision'      => 'A world where every small business runs on clear, live numbers instead of fragile spreadsheets.',
    'mission'     => 'To turn the workbooks businesses already rely on into simple, secure software, quickly and affordably, so owners spend their time on the business and not on the spreadsheet.',
    'base_url'    => 'https://flowsuit.net',   // no trailing slash
    'contact_email' => 'customerservices@flowsuit.net',   // a cPanel forwarder sends it to the owner's inbox

    // Website chat assistant. The API key is NOT here: it lives in ~/flowsuit-secrets.php
    // on the server (outside the repo). Without a key the chat answers from the FAQ only.
    'chat_model'          => 'claude-opus-5-5',
    'chat_limit_per_hour' => 20,   // messages per visitor IP

    // Lets search engines index the site. When false, every page sends "noindex"
    // and robots.txt blocks crawlers. Turned on 2026-10-17 after the owner approved the copy.
    // Home page video: a YouTube video id (the part after watch?v=). Leave empty to hide the section.
    'video_id'    => '',

    'indexable'   => true,

    // Search engine ownership checks: paste only the code from the "HTML tag" option
    // (Google Search Console / Bing Webmaster Tools), not the whole tag. Safe to be public.
    'google_site_verification' => '',
    'bing_site_verification'   => '',
];
