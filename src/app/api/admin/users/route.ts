import { NextResponse } from 'next/server';
import { getUsers, updateUser, deleteUser } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
  const { id, role, password } = await request.json();
  const updated = await updateUser(id, { role, password });
  if (!updated) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  return NextResponse.json({ user: { id: updated.id, username: updated.username, role: updated.role } });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  const { id } = await request.json();
  if (id === user.id) return NextResponse.json({ error: '不能删除自己' }, { status: 400 });
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
