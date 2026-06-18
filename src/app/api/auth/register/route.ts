import { NextResponse } from 'next/server';
import { createUser, findUser, countUsers } from '@/lib/db';
import { createToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/ratelimit';

const USERNAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;
const MIN_PASSWORD = 8;
const RESERVED = ['admin', 'root', 'system', 'administrator', 'superuser', 'test', 'guest'];

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`register:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: `注册过于频繁，请 ${Math.ceil(rl.retryAfter / 60)} 分钟后再试` }, { status: 429 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: '请求格式错误' }, { status: 400 }); }
  const { username, password } = body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
  }
  const usernameTrim = username.trim();
  if (!USERNAME_RE.test(usernameTrim)) {
    return NextResponse.json({ error: '用户名为 2-20 位字母/数字/下划线/中文' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `密码至少 ${MIN_PASSWORD} 位` }, { status: 400 });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: '密码必须包含字母和数字' }, { status: 400 });
  }
  if (RESERVED.includes(usernameTrim.toLowerCase())) {
    return NextResponse.json({ error: '该用户名不可注册' }, { status: 400 });
  }
  if (findUser(usernameTrim)) {
    return NextResponse.json({ error: '用户名已被占用' }, { status: 400 });
  }

  const total = countUsers();
  const role: 'admin' | 'viewer' = total === 0 ? 'admin' : 'viewer';

  try {
    const user = createUser(usernameTrim, password, role);
    const token = await createToken(user.id, user.username, user.role);
    const res = NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
    res.cookies.set('token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7, path: '/' });
    return res;
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
