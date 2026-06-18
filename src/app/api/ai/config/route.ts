import { NextResponse } from 'next/server';
import { getLLMConfig } from '@/lib/llm';

export async function GET() {
  return NextResponse.json(getLLMConfig());
}
