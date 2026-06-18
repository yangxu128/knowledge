'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/useApi';

type TabType = 'markdown' | 'file' | 'url' | 'json';
type Status = { type: 'success' | 'error' | 'redirect'; message: string; href?: string; hrefLabel?: string };
type ImportItem = { title?: unknown; content?: unknown; tags?: unknown; category?: unknown };
type SaveResult = { id?: number; error?: string; count?: number; articles?: { id: number }[] };

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_TEXTAREA = 200_000;
const MAX_BATCH_ITEMS = 50;
const ALLOWED_EXT = ['.md', '.markdown', '.txt'];

function isAllowedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXT.some(ext => lower.endsWith(ext));
}

export default function ImportPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('markdown');
  const [mdContent, setMdContent] = useState('');
  const [mdTitle, setMdTitle] = useState('');
  const [mdTags, setMdTags] = useState('');
  const [mdCategory, setMdCategory] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [scraping, setScraping] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<Status | null>(null);

  const { data: authData } = useApi<{ user: { username: string; role: string } | null }>('/api/auth/me');
  const isLoggedIn = !!authData?.user;
  const canImport = isLoggedIn && (authData?.user?.role === 'admin' || authData?.user?.role === 'editor');

  useEffect(() => {
    if (status?.type === 'redirect' && status.href) {
      const t = setTimeout(() => router.push(status.href!), 800);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  const saveToDb = useCallback(async (article: { title: string; content: string; tags: string[]; category: string; source: string }) => {
    const res = await fetch('/api/admin/imported', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...article,
        published: new Date().toISOString().split('T')[0],
        author: '导入',
      }),
    });
    return res.json();
  }, []);

  const handleMarkdownImport = useCallback(async () => {
    if (!mdContent.trim()) {
      setStatus({ type: 'error', message: '请输入 Markdown 内容' });
      return;
    }
    if (mdContent.length > MAX_TEXTAREA) {
      setStatus({ type: 'error', message: `内容过长（${mdContent.length}），最大 ${MAX_TEXTAREA} 字符` });
      return;
    }
    try {
      const title = mdTitle || '未命名笔记';
      const data = await saveToDb({
        title,
        content: mdContent,
        tags: mdTags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 30),
        category: mdCategory.slice(0, 100) || '导入',
        source: 'markdown',
      });
      if (data.error) throw new Error(data.error);
      setStatus({ type: 'redirect', message: `成功导入「${title}」，正在跳转查看...`, href: `/imported?id=${data.id}`, hrefLabel: '立即查看' });
      setMdContent(''); setMdTitle(''); setMdTags(''); setMdCategory('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请检查格式';
      setStatus({ type: 'error', message: `导入失败：${message}` });
    }
  }, [mdContent, mdTitle, mdTags, mdCategory, saveToDb]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setStatus({ type: 'error', message: `文件过大（${(file.size / 1024 / 1024).toFixed(2)} MB），最大 ${MAX_FILE_SIZE / 1024 / 1024} MB` });
      return;
    }
    if (!isAllowedFile(file.name)) {
      setStatus({ type: 'error', message: `不支持的文件类型，仅允许 ${ALLOWED_EXT.join(', ')}` });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = (ev.target?.result as string) || '';
      if (content.length > MAX_TEXTAREA) {
        setStatus({ type: 'error', message: `文件内容过长（${content.length} 字符），最大 ${MAX_TEXTAREA}` });
        return;
      }
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
      const data = await saveToDb({ title, content, tags: [], category: '导入', source: 'file' });
      if (data.error) { setStatus({ type: 'error', message: `导入失败：${data.error}` }); return; }
      setStatus({ type: 'redirect', message: `成功导入「${file.name}」，正在跳转查看...`, href: `/imported?id=${data.id}`, hrefLabel: '立即查看' });
    };
    reader.onerror = () => setStatus({ type: 'error', message: '文件读取失败' });
    reader.readAsText(file);
  }, [saveToDb]);

  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) {
      setStatus({ type: 'error', message: '请输入 URL' });
      return;
    }
    setScraping(true);
    setStatus({ type: 'redirect', message: '正在抓取网页内容...' });
    try {
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const scraped = await scrapeRes.json();
      if (!scrapeRes.ok) throw new Error(scraped.error || '抓取失败');

      const data = await saveToDb({
        title: scraped.title || urlInput,
        content: scraped.content || '',
        tags: (scraped.tags || ['URL导入']).slice(0, 30),
        category: '导入',
        source: urlInput.trim(),
      });
      if (data.error) throw new Error(data.error);
      setStatus({ type: 'redirect', message: `成功抓取「${scraped.title || urlInput}」，正在跳转查看...`, href: `/imported?id=${data.id}`, hrefLabel: '立即查看' });
      setUrlInput('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '网络错误';
      setStatus({ type: 'error', message: `抓取失败：${message}` });
    } finally {
      setScraping(false);
    }
  }, [urlInput, saveToDb]);

  const handleJsonImport = useCallback(async () => {
    if (!jsonInput.trim()) {
      setStatus({ type: 'error', message: '请输入 JSON 内容' });
      return;
    }
    if (jsonInput.length > MAX_TEXTAREA) {
      setStatus({ type: 'error', message: `JSON 过长（${jsonInput.length}），最大 ${MAX_TEXTAREA} 字符` });
      return;
    }
    try {
      const data = JSON.parse(jsonInput);
      const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : [data]);
      if (items.length === 0) {
        setStatus({ type: 'error', message: 'JSON 数据为空' });
        return;
      }
      if (items.length > MAX_BATCH_ITEMS) {
        setStatus({ type: 'error', message: `批量最多 ${MAX_BATCH_ITEMS} 条` });
        return;
      }
      const res = await fetch('/api/admin/imported', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.filter((i: ImportItem) => i && (typeof i.title === 'string' || typeof i.content === 'string')) }),
      });
      const result = (await res.json()) as SaveResult;
      if (!res.ok || result.error) throw new Error(result.error || '导入失败');
      const articles = result.articles || [];
      const lastId = articles[articles.length - 1]?.id;
      setStatus({ type: 'redirect', message: `成功批量导入 ${result.count ?? articles.length} 条知识，正在跳转查看...`, href: lastId ? `/imported?id=${lastId}` : '/imported', hrefLabel: '查看最新一条' });
      setJsonInput('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请检查格式';
      setStatus({ type: 'error', message: `JSON 导入失败：${message}` });
    }
  }, [jsonInput]);

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'markdown', label: 'Markdown', icon: 'fa-file-code' },
    { key: 'file', label: '文件上传', icon: 'fa-upload' },
    { key: 'url', label: 'URL 抓取', icon: 'fa-link' },
    { key: 'json', label: 'JSON 批量', icon: 'fa-code' },
  ];

  return (
    <div className="page-enter max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">导入知识</h1>
        <p className="text-slate-500">从多种来源导入你的知识笔记</p>
      </div>

      {!canImport && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-warm border border-warm flex items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            <i className="fas fa-info-circle text-accent mr-2"></i>
            {isLoggedIn ? '你的账号没有导入权限（需要 admin/editor 角色）' : '导入功能需要登录'}
          </div>
          <a href="/login?from=/import" className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:shadow-md transition-all">
            {isLoggedIn ? '切换账号' : '去登录'}
          </a>
        </div>
      )}

      <div className="flex items-center gap-1 bg-warm/50 rounded-xl p-1 mb-8">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setStatus(null); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink'}`}
          >
            <i className={`fas ${tab.icon} text-xs`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {status && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-2 page-enter ${
          status.type === 'success' || status.type === 'redirect' ? 'bg-sage-light text-sage' : 'bg-accent-light text-accent'
        }`}>
          <div className="flex items-center gap-2">
            {scraping ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className={`fas ${status.type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}`}></i>
            )}
            {status.message}
          </div>
          {status.href && status.hrefLabel && (
            <a href={status.href} className="font-medium hover:underline shrink-0">
              {status.hrefLabel} →
            </a>
          )}
        </div>
      )}

      {activeTab === 'markdown' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">标题</label>
              <input type="text" value={mdTitle} onChange={e => setMdTitle(e.target.value.slice(0, 200))} placeholder="输入笔记标题" className="w-full bg-warm/50 border border-warm rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">分类</label>
              <input type="text" value={mdCategory} onChange={e => setMdCategory(e.target.value.slice(0, 100))} placeholder="例如：技术文档" className="w-full bg-warm/50 border border-warm rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/30" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">标签（逗号分隔，最多 30 个）</label>
            <input type="text" value={mdTags} onChange={e => setMdTags(e.target.value.slice(0, 500))} placeholder="例如：前端, React, 性能" className="w-full bg-warm/50 border border-warm rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Markdown 内容 <span className="text-slate-400 text-xs">({mdContent.length}/{MAX_TEXTAREA})</span></label>
            <textarea value={mdContent} onChange={e => setMdContent(e.target.value.slice(0, MAX_TEXTAREA))} placeholder="在此输入 Markdown 内容..." className="w-full bg-warm/50 border border-warm rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/30 resize-none h-64 font-mono" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleMarkdownImport} className="px-6 py-2.5 bg-accent text-white rounded-xl font-medium shadow-md shadow-accent/20 hover:shadow-lg transition-all">
              <i className="fas fa-file-import mr-2"></i>导入并查看
            </button>
            <a href="/imported" className="text-sm text-slate-500 hover:text-ink">查看已导入的 →</a>
          </div>
        </div>
      )}

      {activeTab === 'file' && (
        <div>
          <div className="border-2 border-dashed border-warm rounded-2xl p-12 text-center hover:border-accent/30 transition-colors">
            <i className="fas fa-cloud-upload-alt text-4xl text-slate-300 mb-4"></i>
            <p className="text-ink font-medium mb-2">拖拽文件到此处，或点击上传</p>
            <p className="text-sm text-slate-400 mb-4">支持 {ALLOWED_EXT.join(', ')} 文件，最大 {MAX_FILE_SIZE / 1024 / 1024} MB</p>
            <input type="file" accept={ALLOWED_EXT.join(',')} onChange={handleFileImport} className="hidden" id="fileUpload" />
            <label htmlFor="fileUpload" className="inline-block px-6 py-2.5 bg-accent text-white rounded-xl font-medium cursor-pointer shadow-md shadow-accent/20 hover:shadow-lg transition-all">选择文件</label>
          </div>
        </div>
      )}

      {activeTab === 'url' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">网页 URL（仅 http/https）</label>
            <div className="flex gap-3">
              <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://example.com/article" disabled={scraping}
                className="flex-1 bg-warm/50 border border-warm rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/30 disabled:opacity-50" />
              <button onClick={handleUrlImport} disabled={scraping}
                className="px-6 py-2.5 bg-accent text-white rounded-xl font-medium shadow-md shadow-accent/20 hover:shadow-lg transition-all shrink-0 disabled:opacity-50">
                {scraping ? <><i className="fas fa-spinner fa-spin mr-2"></i>抓取中</> : <>抓取并导入</>}
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-400"><i className="fas fa-info-circle mr-1"></i>服务端会抓取网页正文（去除广告/导航），自动提取标题与摘要，导入后可立即查看</p>
        </div>
      )}

      {activeTab === 'json' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">JSON 数据 <span className="text-slate-400 text-xs">({jsonInput.length}/{MAX_TEXTAREA})</span></label>
            <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value.slice(0, MAX_TEXTAREA))} placeholder={'[\n  {\n    "title": "笔记标题",\n    "content": "Markdown 内容",\n    "tags": ["标签1", "标签2"],\n    "category": "分类"\n  }\n]'} className="w-full bg-warm/50 border border-warm rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/30 resize-none h-64 font-mono" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleJsonImport} className="px-6 py-2.5 bg-accent text-white rounded-xl font-medium shadow-md shadow-accent/20 hover:shadow-lg transition-all">
              <i className="fas fa-file-import mr-2"></i>批量导入（最多 {MAX_BATCH_ITEMS} 条）
            </button>
            <a href="/imported" className="text-sm text-slate-500 hover:text-ink">查看已导入的 →</a>
          </div>
        </div>
      )}
    </div>
  );
}
