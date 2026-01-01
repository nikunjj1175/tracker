import { NextResponse } from 'next/server';

export function middleware(request) {
  // Allow public access to login page and API routes
  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  // For other routes, authentication is handled in API routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

