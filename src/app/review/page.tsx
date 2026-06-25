'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReviewCard {
  id: number;
  title: string;
  description: string;
  tags: string[];
  category: string;
  nextReview: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  articleId: number | null;
  source: string;
}

function superMemo2(quality: number, card: ReviewCard): Partial<ReviewCard> {
  let { easeFactor, interval, repetitions } = card;

  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return { interval, easeFactor, repetitions, nextReview: nextReview.toISOString().split('T')[0] };
}

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());
  const [flipped, setFlipped] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHydrated(true);
    fetch('/api/review').then(r => r.json()).then(d => {
      setCards(d.cards || []);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, []);

  const today = hydrated ? new Date().toISOString().split('T')[0] : '9999-99-99';
  const dueCards = cards.filter(c => c.nextReview <= today && !reviewedIds.has(c.id));
  const currentCard = dueCards[0];

  const handleRate = useCallback((quality: number) => {
    if (!currentCard) return;
    const updated = superMemo2(quality, currentCard);
    const newCards = cards.map(c => c.id === currentCard.id ? { ...c, ...updated } : c);
    setCards(newCards);
    setFlipped(false);
    setReviewedIds(prev => new Set(prev).add(currentCard.id));
    fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: newCards, reviewedCardId: currentCard.id, quality }),
    }).catch(() => {});
  }, [currentCard, cards]);

  const ratingLabels = [
    { q: 0, label: '忘记', icon: 'fa-times-circle', color: 'text-red-500 bg-red-50' },
    { q: 1, label: '困难', icon: 'fa-frown', color: 'text-orange-500 bg-orange-50' },
    { q: 2, label: '模糊', icon: 'fa-meh', color: 'text-yellow-500 bg-yellow-50' },
    { q: 3, label: '一般', icon: 'fa-smile', color: 'text-blue-500 bg-blue-50' },
    { q: 4, label: '容易', icon: 'fa-grin', color: 'text-green-500 bg-green-50' },
    { q: 5, label: '极简', icon: 'fa-star', color: 'text-sage bg-sage-light' },
  ];

  return (
    <div className="page-enter max-w-4xl mx-auto px-6 py-10" suppressHydrationWarning>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-ink mb-2">间隔复习</h1>
          <p className="text-slate-500">基于 SuperMemo-2 算法的知识巩固</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">待复习 <span className="font-bold text-accent">{dueCards.length}</span></span>
          <span className="text-slate-400">已完成 <span className="font-bold text-sage">{reviewedIds.size}</span></span>
        </div>
      </div>

      {!hydrated || loading ? (
        <div className="text-center py-20 text-slate-400">
          <i className="fas fa-spinner fa-spin text-2xl"></i>
        </div>
      ) : dueCards.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-sage-light flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-check text-3xl text-sage"></i>
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">今日复习已完成</h2>
          <p className="text-slate-500 mb-6">所有知识卡片都已复习，明天再来吧！</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="/import" className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-medium shadow-md shadow-accent/20 hover:shadow-lg flex items-center gap-2">
              <i className="fas fa-plus"></i>添加新知识
            </a>
            <a href="/graph" className="px-5 py-2.5 bg-warm text-ink rounded-xl text-sm font-medium hover:bg-warm/80 flex items-center gap-2">
              <i className="fas fa-project-diagram"></i>查看知识图谱
            </a>
            <a href="/library" className="px-5 py-2.5 border border-warm text-slate-600 rounded-xl text-sm font-medium hover:bg-warm/50 flex items-center gap-2">
              <i className="fas fa-book-open"></i>浏览知识库
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="text-sm text-slate-400 mb-4">
            {reviewedIds.size + (dueCards.length > 0 ? 1 : 0)} / {reviewedIds.size + dueCards.length}
          </div>

          <div
            className={`flip-card w-full max-w-lg ${flipped ? 'flipped' : ''}`}
            style={{ height: '320px' }}
            role="button"
            tabIndex={0}
            aria-label={flipped ? '复习卡片，已翻转' : '复习卡片，点击翻转'}
            onClick={() => !flipped && setFlipped(true)}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !flipped) { e.preventDefault(); setFlipped(true); } }}
          >
            <div className="flip-card-inner relative w-full h-full">
              <div className="flip-card-front absolute inset-0 bg-white rounded-2xl border border-warm p-8 flex flex-col items-center justify-center cursor-pointer">
                <div className="flex items-center gap-2 mb-4">
                  {currentCard?.tags.slice(0, 2).map((tag: string) => (
                    <span key={tag} className="text-xs font-medium px-2 py-0.5 rounded-full bg-sage-light text-sage">{tag}</span>
                  ))}
                  {currentCard?.source === 'auto' && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent-light text-accent">自动生成</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-ink text-center mb-4">{currentCard?.title}</h2>
                <p className="text-slate-500 text-center mb-6 line-clamp-3">{currentCard?.description}</p>
                <div className="text-sm text-slate-400">
                  <i className="fas fa-hand-pointer mr-1"></i>点击翻转查看详情
                </div>
              </div>

              <div className="flip-card-back absolute inset-0 bg-white rounded-2xl border border-warm p-8 flex flex-col items-center justify-center">
                <h3 className="text-lg font-semibold text-ink mb-4">{currentCard?.title}</h3>
                <p className="text-slate-500 text-center mb-2">分类：{currentCard?.category}</p>
                <p className="text-slate-400 text-sm">间隔：{currentCard?.interval} 天 | 重复：{currentCard?.repetitions} 次</p>
                {currentCard?.articleId && (
                  <a href={`/knowledge/${currentCard.articleId}`} className="text-sm text-accent mt-3 hover:underline">
                    <i className="fas fa-external-link-alt mr-1"></i>查看原文
                  </a>
                )}
                <div className="mt-6 text-sm text-slate-400">你对这个知识点的掌握程度？</div>
              </div>
            </div>
          </div>

          {flipped && (
            <div className="flex items-center gap-2 mt-6 page-enter">
              {ratingLabels.map(r => (
                <button
                  key={r.q}
                  onClick={() => handleRate(r.q)}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-105 ${r.color}`}
                >
                  <i className={`fas ${r.icon}`}></i>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
