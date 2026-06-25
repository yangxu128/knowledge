import { getAllArticles } from '@/lib/articles';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const articles = await getAllArticles();
  return NextResponse.json(articles);
}
