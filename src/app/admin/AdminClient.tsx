'use client';
import { useState, useEffect } from 'react';
import UsersPanel from './UsersPanel';
import ArticlesPanel from './ArticlesPanel';
import ImportedPanel from './ImportedPanel';
import AiPanel from './AiPanel';

type TabKey = 'articles' | 'imported' | 'users' | 'ai';

type User = { id: number; username: string; role: string; createdAt: string };

const tabFromQuery = (): TabKey => {
  if (typeof window === 'undefined') return 'articles';
  const t = new URLSearchParams(window.location.search).get('tab');
  return (['articles', 'imported', 'users', 'ai'] as TabKey[]).includes(t as TabKey) ? (t as TabKey) : 'articles';
};

export default function AdminClient({ user }: { user: User }) {
  const [tab, setTab] = useState<TabKey>(tabFromQuery);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === 'articles') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }, [tab]);

  const tabs: { key: TabKey; label: string; adminOnly?: boolean }[] = [
    { key: 'articles', label: '知识管理' },
    { key: 'imported', label: '导入管理' },
    { key: 'ai', label: 'AI 分析' },
    { key: 'users', label: '用户管理', adminOnly: true },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-ink mb-6">后台管理</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.filter(t => !t.adminOnly || user.role === 'admin').map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? 'bg-accent text-white' : 'bg-warm text-slate-600 hover:bg-warm/80'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'articles' ? <ArticlesPanel /> : tab === 'imported' ? <ImportedPanel /> : tab === 'ai' ? <AiPanel /> : <UsersPanel />}
    </div>
  );
}
