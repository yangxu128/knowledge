import { getAllArticles } from '@/lib/articles';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  const articles = getAllArticles();
  return NextResponse.json(articles);
}
