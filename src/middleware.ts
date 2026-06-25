import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET || '';
  if (s.length < 16) throw new Error('JWT_SECRET 未设置');
  return new TextEncoder().encode(s);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: '未登录' }, { status: 401 });
      return NextResponse.redirect(new URL('/login', request.url));
    }
    try {
      const { payload } = await jwtVerify(token, getSecret());
      if ((pathname.startsWith('/admin/users') || pathname.startsWith('/api/admin/users')) && payload.role !== 'admin') {
        if (pathname.startsWith('/api/')) return NextResponse.json({ error: '无权限' }, { status: 403 });
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      if ((pathname === '/admin' || pathname === '/api/admin') && payload.role !== 'admin' && payload.role !== 'editor') {
        if (pathname.startsWith('/api/')) return NextResponse.json({ error: '无权限' }, { status: 403 });
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: '未登录' }, { status: 401 });
      const res = NextResponse.redirect(new URL('/login', request.url));
      res.cookies.set('token', '', { maxAge: 0, path: '/' });
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
