import { NextResponse } from 'next/server';
import { findUser, verifyPassword } from '@/lib/db';
import { createToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/ratelimit';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `登录尝试过于频繁，请 ${Math.ceil(rl.retryAfter / 60)} 分钟后再试` }, { status: 429 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: '请求格式错误' }, { status: 400 }); }
  const { username, password } = body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }

  const user = await findUser(username.trim());
  if (!user || !verifyPassword(user, password)) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }

  const token = await createToken(user.id, user.username, user.role);
  const res = NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
  res.cookies.set('token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/' });
  return res;
}
