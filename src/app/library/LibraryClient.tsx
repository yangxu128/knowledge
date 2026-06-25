'use client';

import { useState } from 'react';
import { ArticleSummary, tagColors, categoryColors, iconMap } from '@/lib/shared';
import { useApi } from '@/lib/useApi';

interface ImportedArticleItem {
  id: number;
  title: string;
  description?: string;
  tags?: string[];
  category?: string;
  published?: string;
  author?: string;
}

const PAGE_SIZE = 12;

export default function LibraryClient({ articles }: { articles: ArticleSummary[] }) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [page, setPage] = useState(1);
  const { data: impData } = useApi<{ articles: ImportedArticleItem[] }>('/api/imported');
  const importedArticles: ArticleSummary[] = (impData?.articles || []).map((a) => ({
    slug: String(a.id),
    title: a.title,
    description: a.description || '',
    tags: a.tags || ['导入'],
    category: a.category || '导入知识',
    published: a.published || '',
    author: a.author || 'Admin',
  }));
  const importedSlugSet = new Set(importedArticles.map(a => a.slug));

  const categories = ['全部', ...new Set([...articles, ...importedArticles].map(a => a.category))];
  const allTags = [...new Set([...articles, ...importedArticles].flatMap(a => a.tags))];

  const filtered = articles.filter(a => {
    if (selectedCategory !== '全部' && a.category !== selectedCategory) return false;
    if (selectedTag && !a.tags.includes(selectedTag)) return false;
    return true;
  });

  const filteredImported = importedArticles.filter(ia => {
    if (selectedCategory !== '全部' && ia.category !== selectedCategory) return false;
    if (selectedTag && !ia.tags.includes(selectedTag)) return false;
    return true;
  });

  const allArticles = [...filtered, ...filteredImported];
  const totalPages = Math.max(1, Math.ceil(allArticles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedArticles = allArticles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const switchCategory = (cat: string) => { setSelectedCategory(cat); setPage(1); };
  const switchTag = (tag: string) => { setSelectedTag(selectedTag === tag ? '' : tag); setPage(1); };

  return (
    <div className="page-enter max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-ink mb-1">我的知识库</h1>
          <p className="text-slate-500 text-sm">{articles.length + importedArticles.length} 条知识，按主题整理</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-accent-light text-accent' : 'hover:bg-warm text-slate-400'}`}
          >
            <i className="fas fa-th-large text-sm"></i>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-accent-light text-accent' : 'hover:bg-warm text-slate-400'}`}
          >
            <i className="fas fa-list text-sm"></i>
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Filters */}
        <div className="w-48 shrink-0 hidden md:block">
          <div className="sticky top-24">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">分类</h3>
            <div className="space-y-1 mb-6">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => switchCategory(cat)}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === cat ? 'bg-accent-light text-accent font-medium' : 'text-slate-600 hover:bg-warm'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">标签</h3>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => switchTag(tag)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${selectedTag === tag ? 'bg-accent text-white' : 'bg-warm text-slate-600 hover:bg-sage-light hover:text-sage'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {allArticles.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <i className="fas fa-inbox text-4xl mb-4 block"></i>
              <p>暂无文章</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="columns-1 md:columns-2 gap-5">
              {pagedArticles.map(article => {
                const c = categoryColors[article.category] || { bg: 'bg-sage-light', text: 'text-sage' };
                const icon = iconMap[article.tags[0]] || 'fa-file-alt';
                const isImported = importedSlugSet.has(article.slug);
                return (
                  <a
                    key={article.slug}
                    href={isImported ? `/imported?id=${article.slug}` : `/knowledge/${article.slug}`}
                    className="break-inside-avoid bg-white rounded-2xl border border-warm overflow-hidden card-hover cursor-pointer mb-5 block"
                  >
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.text} ${c.bg}`}>{article.tags[0]}</span>
                        {isImported && <span className="text-xs px-2 py-0.5 rounded-full bg-warm text-slate-500">已导入</span>}
                      </div>
                      <h3 className="font-semibold text-ink mb-2">{article.title}</h3>
                      <p className="text-sm text-slate-500 mb-3">{article.description}</p>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{article.author ? `${article.author} · ` : ''}{article.published}</span>
                        <span><i className="fas fa-link mr-1"></i>{article.tags.length}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {pagedArticles.map(article => {
                const c = categoryColors[article.category] || { bg: 'bg-sage-light', text: 'text-sage' };
                const icon = iconMap[article.tags[0]] || 'fa-file-alt';
                const isImported = importedSlugSet.has(article.slug);
                return (
                  <a
                    key={article.slug}
                    href={isImported ? `/imported?id=${article.slug}` : `/knowledge/${article.slug}`}
                    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-warm hover:border-warm/80 cursor-pointer transition-all hover:shadow-sm block"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
                      <i className={`fas ${icon} ${c.text}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${c.text}`}>{article.tags[0]}</span>
                        {isImported && <span className="text-xs px-1.5 py-0.5 rounded bg-warm text-slate-500">已导入</span>}
                        <span className="text-xs text-slate-400">{article.author ? `${article.author} · ` : ''}{article.published}</span>
                      </div>
                      <h3 className="font-medium text-ink text-sm">{article.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{article.description}</p>
                    </div>
                    <div className="text-xs text-slate-400 shrink-0">
                      <i className="fas fa-link mr-1"></i>{article.tags.length}
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                className="px-4 py-2 rounded-lg text-sm border border-warm disabled:opacity-40 hover:bg-warm transition-colors">
                <i className="fas fa-chevron-left mr-1"></i>上一页
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm transition-colors ${p === currentPage ? 'bg-accent text-white' : 'border border-warm hover:bg-warm'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                className="px-4 py-2 rounded-lg text-sm border border-warm disabled:opacity-40 hover:bg-warm transition-colors">
                下一页<i className="fas fa-chevron-right ml-1"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
