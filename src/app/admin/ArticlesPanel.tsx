'use client';
import { useState, useEffect } from 'react';

type Article = {
  slug: string; title: string; description: string; tags: string[];
  category: string; published: string; author: string; content: string;
};

const emptyArticle: Partial<Article> = { slug: '', title: '', description: '', tags: [], category: '', published: '', author: '', content: '' };

export default function ArticlesPanel() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = async () => {
    const res = await fetch('/api/admin/articles');
    const data = await res.json();
    if (res.ok) setArticles(data.articles);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const method = isNew ? 'POST' : 'PUT';
    const res = await fetch('/api/admin/articles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    if (res.ok) { setEditing(null); setIsNew(false); load(); }
    else { const d = await res.json(); alert(d.error); }
  };

  const remove = async (slug: string) => {
    if (!confirm('确定删除？')) return;
    await fetch('/api/admin/articles', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) });
    load();
  };

  if (loading) return <div className="text-slate-400">加载中...</div>;

  if (editing) return (
    <div className="bg-white rounded-2xl border border-warm p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-ink">{isNew ? '新建文章' : '编辑文章'}</h2>
        <button onClick={() => { setEditing(null); setIsNew(false); }} className="text-sm text-slate-400 hover:text-ink">取消</button>
      </div>
      {isNew && <input placeholder="slug（文件名）" value={editing.slug || ''} onChange={e => setEditing({ ...editing, slug: e.target.value })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />}
      <input placeholder="标题" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
      <input placeholder="描述" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
      <input placeholder="标签（逗号分隔）" value={(editing.tags || []).join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
      <div className="flex gap-4">
        <input placeholder="分类" value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })}
          className="flex-1 px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
        <input placeholder="作者" value={editing.author || ''} onChange={e => setEditing({ ...editing, author: e.target.value })}
          className="flex-1 px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
      </div>
      <input type="date" value={editing.published || ''} onChange={e => setEditing({ ...editing, published: e.target.value })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
      <textarea placeholder="内容（Markdown）" value={editing.content || ''} onChange={e => setEditing({ ...editing, content: e.target.value })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm h-64 resize-y" />
      <button onClick={save} className="px-6 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90">保存</button>
    </div>
  );

  return (
    <div>
      <button onClick={() => { setEditing(emptyArticle); setIsNew(true); }}
        className="mb-4 px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90">
        + 新建文章
      </button>
      <div className="bg-white rounded-2xl border border-warm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-warm">
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">标题</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">分类</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">作者</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">标签</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">日期</th>
            <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">操作</th>
          </tr></thead>
          <tbody>
            {articles.map(a => (
              <tr key={a.slug} className="border-t border-warm">
                <td className="px-5 py-3 text-sm text-ink">{a.title}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{a.category}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{a.author || '-'}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{(a.tags || []).join(', ')}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{a.published}</td>
                <td className="px-5 py-3 flex gap-3">
                  <button onClick={() => { setEditing(a); setIsNew(false); }} className="text-sm text-accent hover:underline">编辑</button>
                  <button onClick={() => remove(a.slug)} className="text-sm text-red-500 hover:underline">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
