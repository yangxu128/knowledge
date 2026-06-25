import { getArticlesByTag, getAllTags } from '@/lib/articles';
import { getImportedArticles } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TagPage({ params, searchParams }: { params: Promise<{ tag: string }>; searchParams: Promise<{ from?: string }> }) {
  const { tag } = await params;
  const { from } = await searchParams;
  const builtinArticles = await getArticlesByTag(tag);

  const importedArticles = (await getImportedArticles()).filter(a => a.tags.includes(tag));

  const allArticles = [
    ...builtinArticles.map(a => ({ title: a.title, description: a.description || '', tags: a.tags, category: a.category, published: a.published, author: a.author || '', href: `/knowledge/${a.slug}` })),
    ...importedArticles.map(a => ({ title: a.title, description: a.content.replace(/^---[\s\S]*?---\n*/, '').slice(0, 120), tags: a.tags, category: a.category || '导入知识', published: a.published || '', author: a.author || '', href: `/knowledge/${a.id}` })),
  ];

  const backHref = from === 'graph' ? '/graph' : from === 'search' ? '/search' : '/tags';
  const backLabel = from === 'graph' ? '返回图谱' : from === 'search' ? '返回搜索' : '返回标签索引';

  return (
    <div className="page-enter max-w-6xl mx-auto px-6 py-10">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-ink mb-6">
        <i className="fas fa-arrow-left text-xs"></i>{backLabel}
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-4 py-1.5 rounded-full bg-accent-light text-accent text-sm font-medium">
            <i className="fas fa-tag mr-1.5"></i>{tag}
          </span>
          <span className="text-sm text-slate-400">{allArticles.length} 篇文章</span>
        </div>
      </div>

      {allArticles.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <i className="fas fa-inbox text-4xl mb-4"></i>
          <p>该标签下暂无文章</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allArticles.map(article => (
            <a key={article.href} href={article.href} className="bg-white rounded-2xl border border-warm p-5 card-hover">
              <div className="flex items-center gap-2 mb-2">
                {article.tags.filter(t => t !== tag).slice(0, 2).map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-sage-light text-sage">{t}</span>
                ))}
                <span className="text-xs text-slate-400 ml-auto">{article.category}</span>
              </div>
              <h3 className="font-semibold text-ink mb-1.5">{article.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2">{article.description}</p>
              <div className="text-xs text-slate-400 mt-3">{article.author ? `${article.author} · ` : ''}{article.published}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
