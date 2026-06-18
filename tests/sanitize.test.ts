import { describe, it, expect } from 'vitest';
import {
  sanitizeString, sanitizeTitle, sanitizeContent, sanitizeAuthor,
  sanitizeCategory, sanitizeSource, sanitizeUrl, sanitizeTags,
  scanDangerousContent, isValidDateString, limits,
} from '@/lib/sanitize';

describe('sanitize', () => {
  it('sanitizeString truncates and strips control chars', () => {
    expect(sanitizeString('hello\x00world', 100)).toBe('helloworld');
    expect(sanitizeString('a'.repeat(20), 5)).toBe('aaaaa');
    expect(sanitizeString(123 as unknown as string, 10)).toBe('');
    expect(sanitizeString(null as unknown as string, 10)).toBe('');
  });

  it('sanitizeTitle trims and caps length', () => {
    expect(sanitizeTitle('  标题  ')).toBe('标题');
    expect(sanitizeTitle('a'.repeat(300))).toHaveLength(limits.MAX_TITLE);
    expect(sanitizeTitle(undefined)).toBe('');
  });

  it('sanitizeContent preserves newlines and caps', () => {
    const s = 'line1\nline2\n\nline3';
    expect(sanitizeContent(s)).toBe(s);
    expect(sanitizeContent('a'.repeat(300_000))).toHaveLength(limits.MAX_CONTENT);
  });

  it('sanitizeSource only allows http(s)', () => {
    expect(sanitizeSource('https://example.com')).toBe('https://example.com');
    expect(sanitizeSource('http://example.com/path?q=1')).toBe('http://example.com/path?q=1');
    expect(sanitizeSource('javascript:alert(1)')).toBe('');
    expect(sanitizeSource('file:///etc/passwd')).toBe('');
    expect(sanitizeSource('not a url')).toBe('');
  });

  it('sanitizeUrl same rules as source', () => {
    expect(sanitizeUrl('https://a.b')).toBe('https://a.b');
    expect(sanitizeUrl('ftp://x.y')).toBe('');
  });

  it('sanitizeTags dedupes, caps per tag, caps count', () => {
    expect(sanitizeTags(['a', 'b', 'a', 'A', '', null as unknown as string, 'a'.repeat(100)]))
      .toEqual(['a', 'b', 'a'.repeat(50)]);
    const many = Array.from({ length: 50 }, (_, i) => `t${i}`);
    expect(sanitizeTags(many)).toHaveLength(limits.MAX_TAGS);
  });

  it('scanDangerousContent flags script/iframe/on-event/data:html', () => {
    expect(scanDangerousContent('hello world').safe).toBe(true);
    expect(scanDangerousContent('<script>alert(1)</script>').safe).toBe(false);
    expect(scanDangerousContent('<iframe src="x"></iframe>').safe).toBe(false);
    expect(scanDangerousContent('<a href="javascript:1">x</a>').safe).toBe(false);
    expect(scanDangerousContent('<img src=x onerror="alert(1)">').safe).toBe(false);
    expect(scanDangerousContent('data:text/html,<script>1</script>').safe).toBe(false);
    expect(scanDangerousContent('<form action="x">x</form>').safe).toBe(false);
  });

  it('isValidDateString enforces yyyy-mm-dd', () => {
    expect(isValidDateString('2024-01-15')).toBe(true);
    expect(isValidDateString('2024/01/15')).toBe(false);
    expect(isValidDateString('abc')).toBe(false);
    expect(isValidDateString(null)).toBe(false);
  });

  it('sanitizeAuthor/category trim and cap', () => {
    expect(sanitizeAuthor('  Alice  ')).toBe('Alice');
    expect(sanitizeCategory('  ')).toBe('');
    expect(sanitizeAuthor('a'.repeat(500))).toHaveLength(limits.MAX_AUTHOR);
  });
});
