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
    'check'  => $svg('<path d="M5 12l5 5 9-10"/>'),
    'cross'  => $svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    'arrow'  => $svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
];
