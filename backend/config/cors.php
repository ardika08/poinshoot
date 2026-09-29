<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],

    // Asal yang diizinkan — env-driven supaya dev/prod terpisah.
    // Dev:  FRONTEND_URL=http://localhost:8081 (fallback)
    // Prod: FRONTEND_URL=https://<frontend-slug>.sslip.io (set di Coolify)
    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:8081'),
        'http://localhost:8081',
        'http://localhost:3000',
    ],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
