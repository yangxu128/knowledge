import { NextResponse } from 'next/server';
import { remark } from 'remark';
import html from 'remark-html';
import gfm from 'remark-gfm';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/ratelimit';
import { sanitizeString, scanDangerousContent, limits } from '@/lib/sanitize';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const rl = rateLimit(`render:${user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }
  const rlIp = rateLimit(`render-ip:${getClientIp(request)}`, 200, 60_000);
  if (!rlIp.ok) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${rlIp.retryAfter} 秒后再试` },
      { status: 429, headers: { 'Retry-After': String(rlIp.retryAfter) } }
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '无效的请求体' }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>)?.content;
  if (typeof raw !== 'string' || !raw) {
    return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
  }
  if (raw.length > limits.MAX_RENDER) {
    return NextResponse.json({ error: `内容过长（${raw.length}），最大允许 ${limits.MAX_RENDER}` }, { status: 413 });
  }

  const check = scanDangerousContent(raw);
  if (!check.safe) {
    return NextResponse.json({ error: `内容包含不安全元素：${check.reason}` }, { status: 400 });
  }

  try {
    const cleaned = sanitizeString(raw, limits.MAX_RENDER)
      .replace(/```(\w+)\s+theme=\{null\}/g, '```$1')
      .replace(/```text\s+theme=\{null\}/g, '```text');
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const headings: { id: string; text: string; depth: number }[] = [];
    let m;
    while ((m = headingRegex.exec(cleaned)) !== null) {
      const text = m[2].trim();
      const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-');
      headings.push({ id, text, depth: m[1].length });
    }
    const result = await remark().use(gfm).use(html).process(cleaned);
    let htmlStr = String(result);
    headings.forEach(h => {
      const tag = `h${h.depth}`;
      htmlStr = htmlStr.replace(
        new RegExp(`<${tag}>${h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</${tag}>`),
        `<${tag} id="${h.id}">${h.text}</${tag}>`
      );
    });
    return NextResponse.json({ html: htmlStr, headings });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
