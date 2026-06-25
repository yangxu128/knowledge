import { NextResponse } from 'next/server';
import { getImportedArticles, storeArticleKeywords } from '@/lib/db';
import { extractKeywords } from '@/lib/llm';
import { getCurrentUser } from '@/lib/auth';

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }

  const articles = await getImportedArticles();
  const results: { id: number; title: string; count: number; error?: string }[] = [];

  for (const article of articles) {
    try {
      const keywords = await extractKeywords(article.title, article.content);
      await storeArticleKeywords(article.id, keywords);
      results.push({ id: article.id, title: article.title, count: keywords.length });
    } catch (e: any) {
      results.push({ id: article.id, title: article.title, count: 0, error: e.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
