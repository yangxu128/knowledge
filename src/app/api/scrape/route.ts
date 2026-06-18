import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/ratelimit';
import { sanitizeUrl, scanDangerousContent, limits } from '@/lib/sanitize';

function isPrivateHost(host: string): boolean {
  if (host === 'localhost' || host === '0.0.0.0') return true;
  if (host.startsWith('127.') || host.startsWith('10.')) return true;
  if (host.startsWith('192.168.')) return true;
  if (host.startsWith('169.254.')) return true;
  if (host.startsWith('172.')) {
    const seg = parseInt(host.split('.')[1]);
    if (seg >= 16 && seg <= 31) return true;
  }
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  if (host.startsWith('fe80:')) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split('.').map(Number);
    if (parts[0] === 0 || parts[0] >= 240) return true;
  }
  return false;
}

function isPrivateUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
    if (isPrivateHost(u.hostname.toLowerCase())) return true;
    return false;
  } catch {
    return true;
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const rl = rateLimit(`scrape:${user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `请求过于频繁，请 ${rl.retryAfter} 秒后再试` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }
  const rlIp = rateLimit(`scrape-ip:${getClientIp(request)}`, 60, 60_000);
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
  const raw = (body as Record<string, unknown>)?.url;
  const url = sanitizeUrl(raw);
  if (!url) return NextResponse.json({ error: 'URL 不合法或非 http(s)' }, { status: 400 });
  if (isPrivateUrl(url)) return NextResponse.json({ error: '不允许访问内网地址' }, { status: 403 });

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return NextResponse.json({ error: `请求失败: ${res.status}` }, { status: 400 });

    const contentType = res.headers.get('content-type') || '';
    const contentLength = Number(res.headers.get('content-length') || '0');
    if (contentLength > limits.MAX_SCRAPE_BYTES) {
      return NextResponse.json({ error: `内容过大（${contentLength} 字节），最大允许 ${limits.MAX_SCRAPE_BYTES} 字节` }, { status: 413 });
    }

    const reader = res.body?.getReader();
    if (!reader) return NextResponse.json({ error: '无法读取响应' }, { status: 500 });

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > limits.MAX_SCRAPE_BYTES) {
        try { await reader.cancel(); } catch {}
        return NextResponse.json({ error: `内容过大（超过 ${limits.MAX_SCRAPE_BYTES} 字节）` }, { status: 413 });
      }
      chunks.push(value);
    }
    const buf = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map(c => Buffer.from(c))));
    const html = buf.length > limits.MAX_SCRAPE_BYTES ? buf.slice(0, limits.MAX_SCRAPE_BYTES) : buf;

    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || url;
    const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1] || '';

    let bodyHtml = html;
    bodyHtml = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
    bodyHtml = bodyHtml.replace(/<style[\s\S]*?<\/style>/gi, '');
    bodyHtml = bodyHtml.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    bodyHtml = bodyHtml.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    bodyHtml = bodyHtml.replace(/<header[\s\S]*?<\/header>/gi, '');
    bodyHtml = bodyHtml.replace(/<aside[\s\S]*?<\/aside>/gi, '');
    bodyHtml = bodyHtml.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    bodyHtml = bodyHtml.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

    const articleMatch = bodyHtml.match(/<article[\s\S]*?<\/article>/i);
    if (articleMatch) bodyHtml = articleMatch[0];
    else {
      const mainMatch = bodyHtml.match(/<main[\s\S]*?<\/main>/i);
      if (mainMatch) bodyHtml = mainMatch[0];
    }

    let md = bodyHtml;
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
    md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n\n');
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, '![$1]');
    md = md.replace(/<[^>]+>/g, '');
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");
    md = md.replace(/\n{3,}/g, '\n\n');
    md = md.trim();

    if (md.length > limits.MAX_CONTENT) md = md.slice(0, limits.MAX_CONTENT);

    const check = scanDangerousContent(md);
    if (!check.safe) {
      return NextResponse.json({ error: `抓取内容包含不安全元素：${check.reason}` }, { status: 400 });
    }

    const domain = new URL(url).hostname.replace('www.', '');
    const tags = [domain];
    if (contentType.includes('text/html')) tags.push('网页');

    return NextResponse.json({ title, description, content: md, tags, source: url });
  } catch (e: unknown) {
    return NextResponse.json({ error: `抓取失败: ${(e as Error).message}` }, { status: 500 });
  }
}
