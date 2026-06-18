'use client';
import { useState, useEffect, useRef } from 'react';

export default function UserMenu() {
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d.user)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setOpen(false);
  };

  if (!user) {
    return (
      <a href="/login" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink transition-colors">
        <div className="w-8 h-8 rounded-full bg-warm flex items-center justify-center">
          <i className="fas fa-user text-xs text-slate-400"></i>
        </div>
      </a>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
          {user.username[0].toUpperCase()}
        </div>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl border border-warm shadow-lg py-2 z-50" style={{ minWidth: '160px' }}>
          <div className="px-4 py-2.5 border-b border-warm" style={{ whiteSpace: 'nowrap' }}>
            <p className="text-sm font-medium text-ink">{user.username}</p>
            <p className="text-xs text-slate-400">{user.role === 'admin' ? '管理员' : user.role === 'editor' ? '编辑' : '访客'}</p>
          </div>
          <a href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-warm/50 transition-colors" style={{ whiteSpace: 'nowrap' }}>
            <i className="fas fa-cog text-xs" style={{ width: '16px' }}></i>后台管理
          </a>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-warm/50 transition-colors w-full text-left" style={{ whiteSpace: 'nowrap' }}>
            <i className="fas fa-sign-out-alt text-xs" style={{ width: '16px' }}></i>退出登录
          </button>
        </div>
      )}
    </div>
  );
}
