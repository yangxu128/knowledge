import { NextResponse } from 'next/server';
import { getRecommendedArticles } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ recommendations: [] });
  return NextResponse.json({ recommendations: await getRecommendedArticles(3) });
}
