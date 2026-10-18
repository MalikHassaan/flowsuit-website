<?php
// Simple line icons, drawn in the current text colour.
$svg = fn(string $paths) => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $paths . '</svg>';

return [
    'boxes'  => $svg('<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>'),
    'ledger' => $svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>'),
    'store'  => $svg('<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V9z"/><path d="M5 13v8h14v-8"/>'),
    'sheet'  => $svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
    'bolt'   => $svg('<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>'),
    'phone'  => $svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
    'search' => $svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    'erp'    => $svg('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M17 13v8M13 17h8"/>'),
    'chart'  => $svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    'shield' => $svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>'),
    'cloud'  => $svg('<path d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9H7z"/>'),
    'cart'   => $svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11.5l2-8H6.5"/>'),
    'truck'  => $svg('<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
    'factory'=> $svg('<path d="M3 21V10l6 4V10l6 4V6l6 3v12H3z"/><path d="M7 17h2M12 17h2M17 17h1"/>'),
    'pill'   => $svg('<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/>'),
    'build'  => $svg('<path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-5h6v5M9 9h1M14 9h1M9 13h1M14 13h1"/>'),
    'brief'  => $svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'),
    'check'  => $svg('<path d="M5 12l5 5 9-10"/>'),
    'cross'  => $svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    'arrow'  => $svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    'chat'   => $svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>'),
    'send'   => $svg('<path d="M4 12l16-8-6 16-2.5-6.5L4 12z"/>'),
    'eye'    => $svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    'target' => $svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    'users'  => $svg('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-5-5.7"/>'),
    'lock'   => $svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    'mail'   => $svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
];
