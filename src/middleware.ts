import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth/middleware';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  return authMiddleware(request);
}

export const config = {
  matcher: [
    '/orders/:path*',
    '/account/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/reset-password',
    '/api/auth/me',
    '/api/auth/device',
  ],
};
