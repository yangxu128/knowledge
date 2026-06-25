import { NextResponse } from 'next/server';
import { getTagRelations, getArticleRelations } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ tagRelations: [], articleRelations: [] });
  const [tagRelations, articleRelations] = await Promise.all([
    getTagRelations(),
    getArticleRelations().catch(() => []),
  ]);
  return NextResponse.json({ tagRelations, articleRelations });
}
