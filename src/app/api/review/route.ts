import { NextResponse } from 'next/server';
import { getReviewCards, batchUpsertReviewCards, autoGenerateReviewCards, addReviewHistory, ReviewCard } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

let _lastAutoGen = 0;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ cards: [] });
  const now = Date.now();
  if (now - _lastAutoGen > 60 * 60 * 1000) {
    _lastAutoGen = now;
    try { await autoGenerateReviewCards(); } catch {}
  }
  return NextResponse.json({ cards: await getReviewCards() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效数据' }, { status: 400 });
  }
  const { cards, reviewedCardId, quality } = body as { cards?: unknown; reviewedCardId?: unknown; quality?: unknown };
  if (!Array.isArray(cards)) return NextResponse.json({ error: '无效数据' }, { status: 400 });
  const validCards = cards.filter((c): c is Omit<ReviewCard, 'id'> & { id?: number } =>
    typeof c === 'object' && c !== null && typeof (c as Record<string, unknown>).title === 'string'
  );
  await batchUpsertReviewCards(validCards);
  if (typeof reviewedCardId === 'number' && typeof quality === 'number') {
    try { await addReviewHistory(reviewedCardId, quality); } catch {}
  }
  return NextResponse.json({ ok: true });
}
