'use client';
import { useState } from 'react';

export default function ScrapePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string; description: string; content: string; tags: string[]; source: string } | null>(null);
  const [error, setError] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saved, setSaved] = useState(false);

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
      setEditTitle(data.title);
      setEditTags(data.tags.join(', '));
      setEditCategory('网页收藏');
    } catch { setError('请求失败'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!result) return;
    const res = await fetch('/api/admin/imported', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        content: result.content,
        tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
        category: editCategory || '网页收藏',
        published: new Date().toISOString().split('T')[0],
        author: '搜刮',
        source: result.source,
      }),
    });
    if (res.ok) setSaved(true);
  };

  const handleSaveAsMd = async () => {
    if (!result) return;
    const slug = editTitle.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') || 'scraped-' + Date.now();
    await fetch('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title: editTitle,
        description: result.description,
        tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
        category: editCategory || '网页收藏',
        published: new Date().toISOString().split('T')[0],
        content: result.content,
      }),
    });
    setSaved(true);
  };

  return (
    <div className="page-enter max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">知识搜刮</h1>
        <p className="text-slate-500">输入网址，自动抓取内容到知识库</p>
      </div>

      <div className="flex gap-3 mb-6">
        <input type="url" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          className="flex-1 bg-warm/50 border border-warm rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/30"
          onKeyDown={e => e.key === 'Enter' && handleScrape()} />
        <button onClick={handleScrape} disabled={loading}
          className="px-6 py-2.5 bg-accent text-white rounded-xl font-medium shadow-md shadow-accent/20 hover:shadow-lg transition-all disabled:opacity-50 shrink-0">
          {loading ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-search mr-2"></i>}
          {loading ? '抓取中...' : '搜刮'}
        </button>
      </div>

      {error && <div className="bg-accent-light text-accent text-sm px-4 py-3 rounded-xl mb-6"><i className="fas fa-exclamation-circle mr-2"></i>{error}</div>}

      {result && (
        <div className="bg-white rounded-2xl border border-warm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">标题</label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink mb-1.5">标签</label>
              <input value={editTags} onChange={e => setEditTags(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink mb-1.5">分类</label>
              <input value={editCategory} onChange={e => setEditCategory(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-warm bg-paper text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">来源</label>
            <a href={result.source} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline break-all">{result.source}</a>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">内容预览</label>
            <div className="bg-paper border border-warm rounded-xl p-4 max-h-80 overflow-y-auto text-sm text-slate-600 whitespace-pre-wrap">{result.content.slice(0, 3000)}{result.content.length > 3000 ? '...' : ''}</div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saved}
              className="px-6 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              <i className="fas fa-download mr-2"></i>{saved ? '已保存到导入' : '保存到导入'}
            </button>
            <button onClick={handleSaveAsMd} disabled={saved}
              className="px-6 py-2 rounded-xl bg-sage text-white text-sm font-medium hover:bg-sage/90 disabled:opacity-50">
              <i className="fas fa-file-alt mr-2"></i>{saved ? '已保存' : '保存为知识库文章'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
