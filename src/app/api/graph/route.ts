import { NextResponse } from 'next/server';
import { getTagRelations } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ tagRelations: [] });
  const tagRelations = await getTagRelations();
  return NextResponse.json({ tagRelations });
}
