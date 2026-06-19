import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET || '');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (pathname.startsWith('/admin/users') && payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      if (pathname === '/admin' && payload.role !== 'admin' && payload.role !== 'editor') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch {
      const res = NextResponse.redirect(new URL('/login', request.url));
      res.cookies.set('token', '', { maxAge: 0, path: '/' });
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
