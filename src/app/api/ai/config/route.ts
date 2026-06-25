import { NextResponse } from 'next/server';
import { getLLMConfig } from '@/lib/llm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  return NextResponse.json(getLLMConfig());
}
