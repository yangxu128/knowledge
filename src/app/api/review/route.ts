import { NextResponse } from 'next/server';
import { getReviewCards, batchUpsertReviewCards, ReviewCard } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ cards: [] });
  return NextResponse.json({ cards: await getReviewCards() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效数据' }, { status: 400 });
  }
  const { cards } = body as { cards?: unknown };
  if (!Array.isArray(cards)) return NextResponse.json({ error: '无效数据' }, { status: 400 });
  const validCards = cards.filter((c): c is Omit<ReviewCard, 'id'> & { id?: number } =>
    typeof c === 'object' && c !== null && typeof (c as Record<string, unknown>).title === 'string'
  );
  await batchUpsertReviewCards(validCards);
  return NextResponse.json({ ok: true });
}
