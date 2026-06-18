import { getArticle, getAllArticles } from '@/lib/articles';
import { notFound } from 'next/navigation';
import ExportButton from './ExportButton';

export async function generateStaticParams() {
  const articles = getAllArticles();
  return articles.map(a => ({ slug: a.slug }));
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const allArticles = getAllArticles();
  const relatedArticles = allArticles
    .filter(a => a.slug !== slug && a.tags.some(t => article.tags.includes(t)))
    .slice(0, 3);

  return (
    <div className="page-enter">
      {/* Reading Progress Bar */}
      <div id="readingProgress" className="fixed top-16 left-0 h-0.5 bg-accent z-40 transition-all duration-150" style={{ width: '0%' }}></div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <a href="/library" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-ink mb-6">
              <i className="fas fa-arrow-left text-xs"></i>返回知识库
            </a>

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                {article.tags.map(tag => (
                  <a key={tag} href={`/tags/${encodeURIComponent(tag)}`} className="text-xs font-medium px-2.5 py-1 rounded-full bg-sage-light text-sage hover:bg-sage hover:text-white transition-colors">
                    {tag}
                  </a>
                ))}
                <span className="text-xs text-slate-400">{article.category}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-ink mb-3">{article.title}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span><i className="fas fa-user mr-1"></i>{article.author}</span>
                <span><i className="fas fa-calendar mr-1"></i>{article.published}</span>
                {article.updated && <span><i className="fas fa-edit mr-1"></i>更新于 {article.updated}</span>}
                <ExportButton
                  title={article.title}
                  content={article.rawContent}
                  tags={article.tags}
                  category={article.category}
                  author={article.author}
                  published={article.published}
                />
              </div>
            </div>

            <div className="reading-mode" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <div className="mt-16 pt-8 border-t border-warm">
                <h2 className="text-lg font-bold text-ink mb-4">
                  <i className="fas fa-link mr-2 text-accent text-sm"></i>相关文章
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {relatedArticles.map(ra => (
                    <a key={ra.slug} href={`/knowledge/${ra.slug}`} className="bg-white rounded-xl border border-warm p-4 card-hover">
                      <div className="flex items-center gap-2 mb-2">
                        {ra.tags.slice(0, 1).map(tag => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-sage-light text-sage">{tag}</span>
                        ))}
                      </div>
                      <h3 className="font-medium text-ink text-sm mb-1">{ra.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2">{ra.description}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Floating TOC */}
          {article.headings.length > 0 && (
            <div className="floating-toc">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">目录</h3>
              <div className="space-y-2">
                {article.headings.map(h => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className="toc-item flex items-center gap-2 text-xs text-slate-500 hover:text-ink transition-colors"
                    data-heading-id={h.id}
                  >
                    <span className="toc-dot"></span>
                    <span className={h.depth === 3 ? 'pl-3' : ''}>{h.text}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client-side scripts for reading progress and TOC highlight */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var slug = ${JSON.stringify(slug)};
          var progressKey = 'progress:knowledge:' + slug;
          var restored = false;

          try {
            var title = ${JSON.stringify(article.title)};
            fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: '阅读了', articleType: 'knowledge', articleId: slug, articleTitle: title, articleHref: '/knowledge/' + slug }), keepalive: true });
          } catch(e) {}

          function restoreProgress(progress) {
            if (typeof progress === 'number' && progress > 0) {
              requestAnimationFrame(function() {
                var max = document.documentElement.scrollHeight - window.innerHeight;
                if (max > 0) window.scrollTo(0, progress * max);
                restored = true;
              });
            } else {
              restored = true;
            }
          }

          fetch('/api/progress?articleType=knowledge&articleId=' + slug)
            .then(function(r) { return r.json(); })
            .then(function(p) {
              if (p.guest) {
                var local = localStorage.getItem(progressKey);
                restoreProgress(local ? parseFloat(local) : null);
              } else {
                restoreProgress(p.progress);
              }
            })
            .catch(function() { restored = true; });

          var saveTimer = null;
          window.addEventListener('scroll', function() {
            var bar = document.getElementById('readingProgress');
            if (!bar) return;
            var scrollTop = window.scrollY;
            var docHeight = document.documentElement.scrollHeight - window.innerHeight;
            var pct = docHeight > 0 ? scrollTop / docHeight : 0;
            bar.style.width = Math.min(pct * 100, 100) + '%';
            if (!restored) return;
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(function() {
              localStorage.setItem(progressKey, String(pct));
              fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleType: 'knowledge', articleId: slug, progress: pct }), keepalive: true }).catch(function(){});
            }, 500);
          });

          var tocItems = document.querySelectorAll('.toc-item');
          if (tocItems.length === 0) return;

          function updateToc() {
            var headings = document.querySelectorAll('.reading-mode h2, .reading-mode h3');
            var currentId = '';
            headings.forEach(function(h) {
              var span = h.querySelector('span[id]');
              if (span) {
                var rect = span.getBoundingClientRect();
                if (rect.top < 120) currentId = span.id;
              }
            });
            tocItems.forEach(function(item) {
              var id = item.getAttribute('data-heading-id');
              var dot = item.querySelector('.toc-dot');
              if (id === currentId) {
                item.classList.add('text-ink', 'font-medium');
                item.classList.remove('text-slate-500');
                if (dot) dot.classList.add('active');
              } else {
                item.classList.remove('text-ink', 'font-medium');
                item.classList.add('text-slate-500');
                if (dot) dot.classList.remove('active');
              }
            });
          }

          window.addEventListener('scroll', updateToc);
          updateToc();
        })();
      ` }} />
    </div>
  );
}
