'use client';
import { useState, useEffect } from 'react';

type User = { id: number; username: string; role: string; createdAt: string };

export default function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (res.ok) setUsers(data.users);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (id: number, role: string) => {
    await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('确定删除？')) return;
    await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  };

  if (loading) return <div className="text-slate-400">加载中...</div>;

  return (
    <div className="bg-white rounded-2xl border border-warm overflow-hidden">
      <table className="w-full">
        <thead><tr className="bg-warm">
          <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">用户名</th>
          <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">角色</th>
          <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">创建时间</th>
          <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">操作</th>
        </tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t border-warm">
              <td className="px-5 py-3 text-sm text-ink">{u.username}</td>
              <td className="px-5 py-3">
                <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                  className="text-sm px-2 py-1 rounded-lg border border-warm bg-paper">
                  <option value="admin">管理员</option>
                  <option value="editor">编辑</option>
                  <option value="viewer">访客</option>
                </select>
              </td>
              <td className="px-5 py-3 text-sm text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="px-5 py-3">
                <button onClick={() => remove(u.id)} className="text-sm text-red-500 hover:underline">删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
