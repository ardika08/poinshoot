<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AdminAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        // Get token from Authorization header or x-admin-token header
        $token = $request->header('Authorization') 
            ?? $request->header('x-admin-token');

        if (!$token) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'MISSING_AUTH_TOKEN',
                    'message' => 'Missing authentication token',
                ],
            ], 401);
        }

        // Trim potential "Bearer " prefix
        $token = preg_replace('/^Bearer\s+/i', '', $token);

        // Find admin by auth_token
        $admin = \App\Models\Admin::where('auth_token', $token)
            ->whereNotNull('token_expires_at')
            ->where('token_expires_at', '>', now())
            ->where('is_active', true)
            ->first();

        if (!$admin) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_TOKEN',
                    'message' => 'Invalid or expired token',
                ],
            ], 401);
        }

        // Attach admin to request
        $request->merge(['admin_id' => $admin->id]);
        $request->attributes->set('current_admin', $admin);

        return $next($request);
    }
}
