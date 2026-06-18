import { NextResponse } from 'next/server';
import { getTagRelations } from '@/lib/db';

export async function GET() {
  const tagRelations = await getTagRelations();
  return NextResponse.json({ tagRelations });
}
