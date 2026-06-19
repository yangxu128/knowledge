import { NextResponse } from 'next/server';
import { getUsers, updateUser, deleteUser } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const VALID_ROLES = ['admin', 'editor', 'viewer'] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  const users = (await getUsers()).map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }));
  return NextResponse.json({ users });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  }
  const { id, role, password } = body as Record<string, unknown>;
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: '无效的 id' }, { status: 400 });
  }
  if (role !== undefined && (typeof role !== 'string' || !VALID_ROLES.includes(role as typeof VALID_ROLES[number]))) {
    return NextResponse.json({ error: '无效的角色' }, { status: 400 });
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
    return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 });
  }
  const updated = await updateUser(id, { role: role as 'admin' | 'editor' | 'viewer' | undefined, password: password as string | undefined });
  if (!updated) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  return NextResponse.json({ user: { id: updated.id, username: updated.username, role: updated.role } });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  }
  const { id } = body as Record<string, unknown>;
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: '无效的 id' }, { status: 400 });
  }
  if (id === user.id) return NextResponse.json({ error: '不能删除自己' }, { status: 400 });
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
