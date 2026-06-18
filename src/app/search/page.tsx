'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/useApi';

interface SearchResult {
  articleType: string;
  articleId: string;
  title: string;
  snippet: string;
  tags: string[];
  category: string;
  author: string;
}

function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const { data, isLoading } = useApi<{ results: SearchResult[]; total: number }>(
    debounced ? `/api/search?q=${encodeURIComponent(debounced)}` : null
  );

  const highlight = (text: string): string => {
    if (!debounced || !text) return text;
    const pattern = debounced.split(/\s+/).filter(Boolean).map(escapeReg).join('|');
    if (!pattern) return text;
    const re = new RegExp(`(${pattern})`, 'gi');
    return text.replace(re, '<mark class="bg-accent-light text-accent px-0.5 rounded">$1</mark>');
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const results = data?.results || [];

  return (
    <div className="page-enter max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">搜索知识</h1>
        <p className="text-slate-500">基于 FTS5 全文索引，毫秒级响应</p>
      </div>

      <div className="relative mb-8">
        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="输入关键词搜索..."
          className="w-full bg-white border border-warm rounded-2xl pl-12 pr-6 py-4 text-lg focus:outline-none focus:border-accent/30 search-glow transition-all"
          autoFocus />
        {query && (
          <button onClick={() => { setQuery(''); setDebounced(''); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink">
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl"></i></div>
      ) : debounced && results.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <i className="fas fa-search text-4xl mb-4"></i>
          <p className="text-lg mb-2">未找到相关结果</p>
          <p className="text-sm">试试其他关键词</p>
        </div>
      ) : results.length > 0 ? (
        <div>
          <p className="text-sm text-slate-400 mb-4">找到 {results.length} 个结果</p>
          <div className="space-y-3">
            {results.map((r, i) => {
              const href = r.articleType === 'imported' ? `/imported?id=${r.articleId}` : `/knowledge/${r.articleId}`;
              return (
                <a key={`${r.articleType}:${r.articleId}:${i}`} href={href}
                  className="block bg-white rounded-xl border border-warm p-5 card-hover">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {r.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-sage-light text-sage">{tag}</span>
                    ))}
                    <span className="text-xs text-slate-400">{r.category}</span>
                    {r.articleType === 'imported' && <span className="text-xs px-2 py-0.5 rounded-full bg-warm text-slate-500">已导入</span>}
                  </div>
                  <h3 className="font-semibold text-ink mb-1" dangerouslySetInnerHTML={{ __html: highlight(r.title) }} />
                  <p className="text-sm text-slate-500" dangerouslySetInnerHTML={{ __html: r.snippet }} />
                  <div className="text-xs text-slate-400 mt-2">{r.author ? `${r.author} · ` : ''}{r.articleType === 'imported' ? '导入知识' : '知识库'}</div>
                </a>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-slate-400">
          <i className="fas fa-lightbulb text-4xl mb-4"></i>
          <p>输入关键词开始搜索</p>
        </div>
      )}
    </div>
  );
}
