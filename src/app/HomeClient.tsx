'use client';

import { ArticleSummary, categoryColors as tagColorMap, iconMap, timeAgo } from '@/lib/shared';
import { useApi } from '@/lib/useApi';

interface Activity {
  id: number;
  action: string;
  articleType: string;
  articleId: string;
  articleTitle: string;
  articleHref: string;
  createdAt: string;
}

interface Recommendation {
  id: number;
  title: string;
  tags: string[];
  category: string;
  author: string;
  description: string;
  score: number;
  reason: string;
}

const actionIcons: Record<string, { icon: string; color: string; bg: string }> = {
  '阅读了': { icon: 'fa-book-open', color: 'text-sage', bg: 'bg-sage-light' },
  '导入了': { icon: 'fa-file-import', color: 'text-accent', bg: 'bg-accent-light' },
  '创建了': { icon: 'fa-pen', color: 'text-accent', bg: 'bg-accent-light' },
  '更新了': { icon: 'fa-edit', color: 'text-sand', bg: 'bg-sand-light' },
  '复习了': { icon: 'fa-layer-group', color: 'text-sage', bg: 'bg-sage-light' },
  '搜刮了': { icon: 'fa-search', color: 'text-purple-600', bg: 'bg-purple-50' },
};

export default function HomeClient({ articles }: { articles: ArticleSummary[] }) {
  const { data: actData, isLoading: actLoading, error: actError } = useApi<{ activities: Activity[] }>('/api/activities');
  const { data: impData, isLoading: impLoading } = useApi<{ articles: { id: number }[] }>('/api/imported');
  const { data: recData, isLoading: recLoading } = useApi<{ recommendations: Recommendation[] }>('/api/recommendations');
  const activities = actData?.activities || [];
  const importedCount = impData?.articles?.length || 0;
  const recommendations = recData?.recommendations || [];

  const todayPicks = recommendations.length > 0
    ? recommendations.map(r => ({
        type: 'recommended' as const,
        href: `/imported?id=${r.id}`,
        title: r.title,
        tags: r.tags,
        category: r.category,
        author: r.author,
        description: r.description,
        reason: r.reason,
      }))
    : articles.slice(0, 3).map(a => ({
        type: 'fallback' as const,
        href: `/knowledge/${a.slug}`,
        title: a.title,
        tags: a.tags,
        category: a.category,
        author: a.author,
        description: a.description,
        reason: '',
      }));
  const totalTags = [...new Set(articles.flatMap(a => a.tags))].length;
  const totalCategories = [...new Set(articles.map(a => a.category))].length;

  return (
    <div className="page-enter">
      <div className="hero-blur pt-12 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-light text-accent text-sm font-medium mb-6">
            <i className="fas fa-sparkles text-xs"></i>
            <span>你的第二大脑</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-4 leading-tight">让知识<br className="md:hidden" />自然生长</h1>
          <p className="text-lg text-slate-500 mb-8 max-w-lg mx-auto leading-relaxed">像种植花园一样管理你的知识。记录、连接、复习，让每一次思考都留下痕迹。</p>
          <div className="flex items-center justify-center gap-3">
            <a href="/explore" className="px-6 py-3 bg-accent text-white rounded-xl font-medium shadow-lg shadow-accent/20 hover:shadow-xl transition-all hover:-translate-y-0.5">开始探索</a>
            <a href="/library" className="px-6 py-3 bg-warm text-ink rounded-xl font-medium hover:bg-warm/80 transition-all">
              <i className="fas fa-layer-group mr-1.5 text-xs"></i>知识库
              <span className="ml-1.5 text-xs bg-accent text-white px-1.5 py-0.5 rounded-full">{articles.length + importedCount}</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-ink">今日推荐</h2>
            <a href="/explore" className="text-sm text-accent hover:underline">查看更多</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {todayPicks.map((article, i) => {
              const c = tagColorMap[article.category] || { bg: 'bg-sage-light', text: 'text-sage' };
              const icon = iconMap[article.tags[0]] || 'fa-file-alt';
              return (
                <a key={i} href={article.href} className={`bg-white rounded-2xl border border-warm overflow-hidden card-hover cursor-pointer stagger-${i+1} page-enter`}>
                  <div className={`h-32 flex items-center justify-center ${c.bg}`}>
                    <i className={`fas text-3xl opacity-40 ${icon} ${c.text}`}></i>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.text} ${c.bg}`}>{article.tags[0]}</span>
                      <span className="text-xs text-slate-400">{article.category}</span>
                      {article.type === 'recommended' && article.reason && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent-light text-accent">{article.reason}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-ink mb-2 line-clamp-2">{article.title}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2">{article.description}</p>
                    {article.author && <div className="text-xs text-slate-400 mt-2">{article.author}</div>}
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-ink mb-6">最近动态</h2>
            {actLoading ? (
              <div className="text-center py-12 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl"></i></div>
            ) : actError ? (
              <div className="text-center py-12 text-slate-400"><i className="fas fa-exclamation-circle text-2xl mb-2"></i><p className="text-sm">加载失败</p></div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <i className="fas fa-clock text-3xl mb-3"></i>
                <p>暂无动态，阅读或导入文章后会自动记录</p>
              </div>
            ) : (
              <div className="relative pl-8 max-h-[560px] overflow-y-auto pr-2 activities-scroll">
                <div className="timeline-line"></div>
                {activities.map((act, i) => {
                  const style = actionIcons[act.action] || { icon: 'fa-circle', color: 'text-slate-500', bg: 'bg-warm' };
                  return (
                    <div key={act.id} className={`relative flex items-start gap-4 stagger-${Math.min(i+1, 5)} page-enter`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 border-2 border-paper ${style.bg}`}>
                        <i className={`fas text-xs ${style.icon} ${style.color}`}></i>
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="text-sm text-slate-600">
                          <span className="text-ink font-medium">{act.action}</span>
                          <a href={act.articleHref} className="text-accent font-medium cursor-pointer hover:underline">{act.articleTitle}</a>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{timeAgo(act.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink mb-6">学习概览</h2>
            <div className="bg-white rounded-2xl border border-warm p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-3 bg-warm/50 rounded-xl">
                  <div className="text-2xl font-bold text-ink">{articles.length + importedCount}</div>
                  <div className="text-xs text-slate-500 mt-1">知识笔记</div>
                </div>
                <div className="text-center p-3 bg-warm/50 rounded-xl">
                  <div className="text-2xl font-bold text-ink">{totalTags}</div>
                  <div className="text-xs text-slate-500 mt-1">知识标签</div>
                </div>
                <div className="text-center p-3 bg-warm/50 rounded-xl">
                  <div className="text-2xl font-bold text-accent">{totalCategories}</div>
                  <div className="text-xs text-slate-500 mt-1">分类</div>
                </div>
                <div className="text-center p-3 bg-warm/50 rounded-xl">
                  <div className="text-2xl font-bold text-sage">{activities.length}</div>
                  <div className="text-xs text-slate-500 mt-1">动态</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
