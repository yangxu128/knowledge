'use client';

import { useState, useEffect, useRef } from 'react';
import { parseFrontmatter } from '@/lib/shared';
import { exportMarkdown } from '@/lib/export';
import MarkdownEditor from '@/components/MarkdownEditor';
import { useApi } from '@/lib/useApi';

interface Heading { id: string; text: string; depth: number; }

interface ArticleObj {
  id: number; title: string; content: string; tags: string[];
  category: string; published: string; author: string; source: string; description?: string;
}

type ListItem = {
  id: number; title: string; description: string;
  tags: string[]; category: string; published: string; author: string;
};

export default function ImportedPage() {
  const [article, setArticle] = useState<ArticleObj | '__list__' | null>(null);
  const [renderedContent, setRenderedContent] = useState('');
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [progressBar, setProgressBar] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  const isList = article === '__list__';
  const { data: listData } = useApi<{ articles: ListItem[]; total: number }>(
    isList ? '/api/imported' : null
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
      setArticle('__list__');
      return;
    }

    fetch(`/api/imported?id=${id}`).then(r => r.json()).then(d => {
      if (d.article) {
        const raw = d.article;
        const { meta } = parseFrontmatter(raw.content);
        const a: ArticleObj = {
          ...raw,
          title: raw.title || (typeof meta.title === 'string' ? meta.title : raw.title),
          tags: raw.tags.length > 0 ? raw.tags : (Array.isArray(meta.tags) ? meta.tags : raw.tags),
          category: raw.category || (typeof meta.category === 'string' ? meta.category : raw.category),
          published: raw.published || (typeof meta.published === 'string' ? meta.published : raw.published),
          author: raw.author || (typeof meta.author === 'string' ? meta.author : raw.author),
          description: raw.description || (typeof meta.description === 'string' ? meta.description : raw.description),
        };
        setArticle(a);
        fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: '阅读了', articleType: 'imported', articleId: String(d.article.id), articleTitle: d.article.title, articleHref: `/imported?id=${d.article.id}` }) }).catch(() => {});
        fetch('/api/progress?articleType=imported&articleId=' + d.article.id).then(r => r.json()).then(p => {
          const restore = (progress: number | null) => {
            if (typeof progress === 'number' && progress > 0) {
              requestAnimationFrame(() => {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                if (max > 0) window.scrollTo(0, progress * max);
                restoredRef.current = true;
              });
            } else {
              restoredRef.current = true;
            }
          };
          if (p.guest) {
            const local = localStorage.getItem(`progress:imported:${d.article.id}`);
            restore(local ? parseFloat(local) : null);
          } else {
            restore(p.progress);
          }
        }).catch(() => { restoredRef.current = true; });
        fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: d.article.content.replace(/^---[\s\S]*?---\n*/, '') }),
        })
          .then(r => r.json())
          .then(d => {
            if (d.html) setRenderedContent(d.html);
            if (d.headings) setHeadings(d.headings);
          })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? scrollTop / docHeight : 0;
      setProgressBar(Math.min(pct * 100, 100));
      if (!restoredRef.current || !article || article === '__list__') return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        localStorage.setItem(`progress:imported:${article.id}`, String(pct));
        fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleType: 'imported', articleId: String(article.id), progress: pct }),
        }).catch(() => {});
      }, 500);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [article]);

  if (article === '__list__') {
    const list = listData?.articles || [];
    return (
      <div className="page-enter max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ink mb-2">已导入的知识</h1>
            <p className="text-slate-500">共 {listData?.total ?? 0} 篇 · 包含 Markdown、URL 抓取、JSON 批量</p>
          </div>
          <a href="/import" className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium shadow-md shadow-accent/20 hover:shadow-lg flex items-center gap-2">
            <i className="fas fa-plus"></i>继续导入
          </a>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <i className="fas fa-inbox text-4xl mb-4 block"></i>
            <p className="mb-6">还没有导入任何知识</p>
            <a href="/import" className="inline-block px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-medium">立即导入</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map(item => (
              <a key={item.id} href={`/imported?id=${item.id}`} className="bg-white rounded-2xl border border-warm p-5 card-hover">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {item.tags.slice(0, 3).map((t, i) => (
                    <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-full bg-sage-light text-sage">{t}</span>
                  ))}
                  <span className="text-xs text-slate-400 ml-auto">{item.category}</span>
                </div>
                <h3 className="font-semibold text-ink mb-1.5 line-clamp-1">{item.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-2">{item.description}</p>
                <div className="text-xs text-slate-400">{item.author ? `${item.author} · ` : ''}{item.published}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <i className="fas fa-file-alt text-4xl text-slate-300 mb-4"></i>
        <p className="text-slate-500 mb-6">未找到该导入文章，可能已被删除</p>
        <div className="flex items-center justify-center gap-4">
          <a href="/imported" className="px-5 py-2.5 bg-warm text-ink rounded-xl text-sm font-medium hover:bg-warm/80">查看所有导入</a>
          <a href="/import" className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium shadow-md shadow-accent/20 hover:shadow-lg">导入新知识</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div id="readingProgress" className="fixed top-16 left-0 h-0.5 bg-accent z-40 transition-all duration-150" style={{ width: progressBar + '%' }}></div>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 mb-6 text-sm">
              <a href="/imported" className="inline-flex items-center gap-2 text-slate-500 hover:text-ink">
                <i className="fas fa-arrow-left text-xs"></i>所有导入
              </a>
              <span className="text-slate-300">|</span>
              <a href="/import" className="inline-flex items-center gap-2 text-slate-500 hover:text-ink">
                <i className="fas fa-plus text-xs"></i>继续导入
              </a>
            </div>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {article.tags.map((tag: string) => (
                  <span key={tag} className="text-xs font-medium px-2 py-0.5 rounded-full bg-sage-light text-sage">{tag}</span>
                ))}
                <span className="text-xs text-slate-400">{article.category}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-light text-accent">导入</span>
              </div>
              <h1 className="text-3xl font-bold text-ink mb-2">{article.title}</h1>
              <div className="text-sm text-slate-400">
                {article.author} · {article.published} · 来源：{article.source}
                <button onClick={() => {
                  const content = article.content.replace(/^---[\s\S]*?---\n*/, '');
                  exportMarkdown(article.title, content, {
                    title: article.title,
                    tags: article.tags,
                    category: article.category,
                    author: article.author,
                    published: article.published,
                  });
                }} className="ml-4 text-accent hover:underline">导出</button>
                <button onClick={() => {
                  setEditContent(article.content.replace(/^---[\s\S]*?---\n*/, ''));
                  setEditMode(true);
                }} className="ml-2 text-accent hover:underline">编辑</button>
                <button onClick={async () => {
                  if (!confirm('确定删除？')) return;
                  await fetch('/api/admin/imported', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: article.id }) });
                  window.location.href = '/imported';
                }} className="ml-2 text-red-500 hover:underline">删除</button>
              </div>
            </div>
            {editMode ? (
              <MarkdownEditor
                initialContent={editContent}
                onSave={async (content) => {
                  await fetch('/api/admin/imported', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...article, content }),
                  });
                  setArticle({ ...article, content });
                }}
              />
            ) : (
              <div className="reading-mode" dangerouslySetInnerHTML={{ __html: renderedContent }} />
            )}
          </div>

          {headings.length > 0 && (
            <div className="floating-toc">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">目录</h3>
              <div className="space-y-2">
                {headings.map(h => (
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

      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var tocItems = document.querySelectorAll('.toc-item');
          if (tocItems.length === 0) return;

          function updateToc() {
            var headings = document.querySelectorAll('.reading-mode h2, .reading-mode h3');
            var currentId = '';
            headings.forEach(function(h) {
              if (h.id) {
                var rect = h.getBoundingClientRect();
                if (rect.top < 120) currentId = h.id;
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
