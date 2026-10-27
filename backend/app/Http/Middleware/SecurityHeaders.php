<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Header keamanan dasar untuk respons API.
 *
 * Backend ini dilayani lewat proxy Vercel (HTTPS -> HTTP), jadi HSTS
 * dipasang di sisi Vercel/domain, bukan di sini. Yang dipasang di sini
 * adalah header yang mencegah browser menebak tipe konten, membingkai
 * halaman, atau mengirim referrer ke pihak lain.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Permissions-Policy' => 'geolocation=(), microphone=(), camera=()',
            'Cross-Origin-Resource-Policy' => 'same-site',
        ];

        foreach ($headers as $name => $value) {
            if (! $response->headers->has($name)) {
                $response->headers->set($name, $value);
            }
        }

        return $response;
    }
}
