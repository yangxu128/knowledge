const MAX_TITLE = 200;
const MAX_CONTENT = 200_000;
const MAX_TAG_LEN = 50;
const MAX_TAGS = 30;
const MAX_CATEGORY = 100;
const MAX_AUTHOR = 100;
const MAX_SOURCE = 2048;
const MAX_BATCH_ITEMS = 50;
const MAX_RENDER = 200_000;
const MAX_SCRAPE_BYTES = 2_000_000;
const MAX_URL_LEN = 2048;
const MAX_JSON_ITEMS = 50;

const DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /<script\b[\s\S]*?>/i, reason: '包含 <script> 标签' },
  { pattern: /<\/script>/i, reason: '包含 </script> 标签' },
  { pattern: /<iframe\b/i, reason: '包含 <iframe> 标签' },
  { pattern: /<object\b/i, reason: '包含 <object> 标签' },
  { pattern: /<embed\b/i, reason: '包含 <embed> 标签' },
  { pattern: /<form\b/i, reason: '包含 <form> 标签' },
  { pattern: /javascript:/i, reason: '包含 javascript: 协议' },
  { pattern: /vbscript:/i, reason: '包含 vbscript: 协议' },
  { pattern: /data:\s*text\/html/i, reason: '包含 data:text/html' },
  { pattern: /\son\w+\s*=\s*["']/i, reason: '包含内联事件处理器' },
  { pattern: /<svg\b[\s\S]*?onload\s*=/i, reason: '包含 svg onload' },
];

const CONTROL_CHARS = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g;

function stripControl(value: string): string {
  return value.replace(CONTROL_CHARS, '');
}

export function sanitizeString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return stripControl(value).slice(0, maxLen);
}

export function sanitizeTitle(value: unknown): string {
  return sanitizeString(value, MAX_TITLE).trim();
}

export function sanitizeContent(value: unknown): string {
  return sanitizeString(value, MAX_CONTENT);
}

export function sanitizeAuthor(value: unknown): string {
  return sanitizeString(value, MAX_AUTHOR).trim();
}

export function sanitizeCategory(value: unknown): string {
  return sanitizeString(value, MAX_CATEGORY).trim();
}

export function sanitizeSource(value: unknown): string {
  const s = sanitizeString(value, MAX_SOURCE).trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return s;
  } catch {
    return '';
  }
}

export function sanitizeUrl(value: unknown, maxLen = MAX_URL_LEN): string {
  const s = sanitizeString(value, maxLen).trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return s;
  } catch {
    return '';
  }
}

export function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of value) {
    if (typeof t !== 'string') continue;
    const clean = stripControl(t).slice(0, MAX_TAG_LEN).trim();
    if (!clean) continue;
    const k = clean.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(clean);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function scanDangerousContent(content: string): { safe: boolean; reason?: string } {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) return { safe: false, reason };
  }
  return { safe: true };
}

export const limits = {
  MAX_TITLE,
  MAX_CONTENT,
  MAX_TAG_LEN,
  MAX_TAGS,
  MAX_CATEGORY,
  MAX_AUTHOR,
  MAX_SOURCE,
  MAX_BATCH_ITEMS,
  MAX_RENDER,
  MAX_SCRAPE_BYTES,
  MAX_URL_LEN,
  MAX_JSON_ITEMS,
};
