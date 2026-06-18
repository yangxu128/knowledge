import { NextResponse } from 'next/server';
import { getReviewCards, batchUpsertReviewCards } from '@/lib/db';

export async function GET() {
  return NextResponse.json({ cards: await getReviewCards() });
}

export async function POST(request: Request) {
  const { cards } = await request.json() as { cards: any[] };
  if (!Array.isArray(cards)) return NextResponse.json({ error: '无效数据' }, { status: 400 });
  await batchUpsertReviewCards(cards as any);
  return NextResponse.json({ ok: true });
}
