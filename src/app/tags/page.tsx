import { getAllTags, getAllArticles } from '@/lib/articles';
import { tagColors } from '@/lib/shared';

export default async function TagsPage() {
  const tags = await getAllTags();
  const articles = await getAllArticles();

  return (
    <div className="page-enter max-w-6xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-ink mb-2">标签索引</h1>
        <p className="text-slate-500">按标签浏览你的知识体系</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-12">
        {tags.map((tag, i) => {
          const count = articles.filter(a => a.tags.includes(tag)).length;
          return (
            <a
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className={`tag-bubble px-5 py-2.5 rounded-full text-sm font-medium ${tagColors[i % tagColors.length]} cursor-pointer`}
            >
              <i className="fas fa-tag mr-1.5 text-xs"></i>
              {tag}
              <span className="ml-2 text-xs opacity-60">{count}</span>
            </a>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags.map((tag, i) => {
          const tagArticles = articles.filter(a => a.tags.includes(tag));
          return (
            <div key={tag} className="bg-white rounded-2xl border border-warm p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tagColors[i % tagColors.length]}`}>{tag}</span>
                <span className="text-xs text-slate-400">{tagArticles.length} 篇</span>
              </div>
              <div className="space-y-2">
                {tagArticles.slice(0, 3).map(a => (
                  <a key={a.slug} href={`/knowledge/${a.slug}`} className="block text-sm text-ink hover:text-accent transition-colors truncate">
                    {a.title}
                  </a>
                ))}
                {tagArticles.length > 3 && (
                  <a href={`/tags/${encodeURIComponent(tag)}`} className="text-xs text-accent hover:underline">
                    查看全部 {tagArticles.length} 篇
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
