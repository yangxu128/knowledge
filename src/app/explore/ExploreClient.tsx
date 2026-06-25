'use client';

import { ArticleSummary, tagColors } from '@/lib/shared';
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

export default function ExploreClient({ serverArticles }: { serverArticles: ArticleSummary[] }) {
  const { data: impData } = useApi<{ articles: ImportedArticleItem[] }>('/api/imported');
  const importedArticles: ArticleSummary[] = (impData?.articles || []).map((a) => ({
    slug: String(a.id),
    title: a.title,
    description: a.description || '',
    tags: a.tags || ['导入'],
    category: a.category || '导入知识',
    published: a.published || '',
    author: a.author || 'Admin',
    isImported: true,
  }));

  const allArticles = [...serverArticles, ...importedArticles];
  const tags = [...new Set(allArticles.flatMap(a => a.tags))];
  const tagCountMap = new Map<string, number>();
  for (const a of allArticles) for (const t of a.tags) tagCountMap.set(t, (tagCountMap.get(t) || 0) + 1);

  return (
    <div className="page-enter max-w-6xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-ink mb-2">探索知识</h1>
        <p className="text-slate-500">发现、浏览、连接你的知识网络</p>
      </div>

      <div className="mb-12">
        <h2 className="text-lg font-semibold text-ink mb-4">
          <i className="fas fa-tags mr-2 text-accent"></i>标签云
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {tags.map((tag, i) => {
            const colorClass = tagColors[i % tagColors.length];
            const count = tagCountMap.get(tag) || 0;
            return (
              <a key={tag} href={`/tags/${encodeURIComponent(tag)}`}
                className={`tag-bubble px-4 py-2 rounded-full text-sm font-medium ${colorClass} cursor-pointer`}>
                {tag}
                <span className="ml-1.5 text-xs opacity-60">{count}</span>
              </a>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-ink mb-4">
          <i className="fas fa-compass mr-2 text-sage"></i>全部文章
        </h2>
        <div className="columns-1 md:columns-2 lg:columns-3 gap-5 space-y-5">
          {allArticles.map((article, i) => {
            const colorClass = tagColors[i % tagColors.length];
            return (
              <a key={article.slug}
                href={`/knowledge/${article.slug}`}
                className="block bg-white rounded-2xl border border-warm p-5 card-hover break-inside-avoid">
                <div className="flex items-center gap-2 mb-3">
                  {article.tags.slice(0, 2).map(tag => (
                    <span key={tag} className={`text-xs font-medium px-2 py-0.5 rounded-full ${tagColors[tags.indexOf(tag) % tagColors.length]}`}>
                      {tag}
                    </span>
                  ))}
                  {article.isImported && <span className="text-xs px-2 py-0.5 rounded-full bg-warm text-slate-500">已导入</span>}
                </div>
                <h3 className="font-semibold text-ink mb-2">{article.title}</h3>
                <p className="text-sm text-slate-500 mb-3">{article.description}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{article.author ? `${article.author} · ` : ''}{article.category}</span>
                  <span>{article.published}</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
