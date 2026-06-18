'use client';
import { useState, useEffect } from 'react';
import { downloadFile } from '@/lib/export';

type ImportedArticle = {
  id: number; title: string; content: string; tags: string[];
  category: string; published: string; author: string; source: string;
};

const PAGE_SIZE = 20;

export default function ImportedPanel() {
  const [articles, setArticles] = useState<ImportedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ImportedArticle | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async () => {
    const res = await fetch(`/api/admin/imported?page=${page}&pageSize=${PAGE_SIZE}`);
    const data = await res.json();
    if (res.ok) { setArticles(data.articles); setTotal(data.total); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  const save = async () => {
    if (!editing) return;
    const method = editing.id ? 'PUT' : 'POST';
    const res = await fetch('/api/admin/imported', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    if (res.ok) { setEditing(null); load(); }
    else { const d = await res.json(); alert(d.error); }
  };

  const remove = async (id: number) => {
    if (!confirm('确定删除？')) return;
    await fetch('/api/admin/imported', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  };

  if (loading) return <div className="text-slate-400">加载中...</div>;

  if (editing) return (
    <div className="bg-white rounded-2xl border border-warm p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-ink">{editing.id ? '编辑' : '新建'}导入文章</h2>
        <button onClick={() => setEditing(null)} className="text-sm text-slate-400 hover:text-ink">取消</button>
      </div>
      <input placeholder="标题" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
      <input placeholder="标签（逗号分隔）" value={(editing.tags || []).join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
      <div className="flex gap-4">
        <input placeholder="分类" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}
          className="flex-1 px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
        <input placeholder="作者" value={editing.author} onChange={e => setEditing({ ...editing, author: e.target.value })}
          className="flex-1 px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
      </div>
      <div className="flex gap-4">
        <input placeholder="发布日期" value={editing.published} onChange={e => setEditing({ ...editing, published: e.target.value })}
          className="flex-1 px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
        <select value={editing.source} onChange={e => setEditing({ ...editing, source: e.target.value })}
          className="flex-1 px-4 py-2 rounded-xl border border-warm bg-paper text-sm">
          <option value="url">URL</option>
          <option value="markdown">Markdown</option>
          <option value="file">文件</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <textarea placeholder="内容（Markdown）" value={editing.content} onChange={e => setEditing({ ...editing, content: e.target.value })}
        className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm h-64 resize-y" />
      <button onClick={save} className="px-6 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90">保存</button>
    </div>
  );

  return (
    <div>
      <button onClick={() => setEditing({ id: 0, title: '', content: '', tags: [], category: '导入', published: '', author: '', source: 'url' })}
        className="mb-4 px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90">
        + 新建导入
      </button>
      <button onClick={() => {
        downloadFile(JSON.stringify(articles, null, 2), `imported-articles-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      }} className="mb-4 ml-2 px-5 py-2 rounded-xl bg-sage text-white text-sm font-medium hover:bg-sage/90">
        导出全部
      </button>
      {articles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <i className="fas fa-inbox text-4xl mb-4"></i>
          <p>暂无导入文章</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-warm overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-warm">
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">标题</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">来源</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">分类</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">作者</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">日期</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">操作</th>
            </tr></thead>
            <tbody>
              {articles.map(a => (
                <tr key={a.id} className="border-t border-warm">
                  <td className="px-5 py-3 text-sm text-ink">{a.title}</td>
                  <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-accent-light text-accent">{a.source}</span></td>
                  <td className="px-5 py-3 text-sm text-slate-500">{a.category}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{a.author || '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-400">{a.published}</td>
                  <td className="px-5 py-3 flex gap-3">
                    <button onClick={() => setEditing(a)} className="text-sm text-accent hover:underline">编辑</button>
                    <button onClick={() => remove(a.id)} className="text-sm text-red-500 hover:underline">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-sm border border-warm disabled:opacity-40 hover:bg-warm">上一页</button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border border-warm disabled:opacity-40 hover:bg-warm">下一页</button>
        </div>
      )}
    </div>
  );
}
