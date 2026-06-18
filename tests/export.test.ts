// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

describe('exportMarkdown', () => {
  it('生成带 frontmatter 的 markdown', async () => {
    const { exportMarkdown } = await import('../src/lib/export');
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    const clickSpy = vi.fn();
    const a = { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(a);

    exportMarkdown('测试/标题', '正文', { title: '测试/标题', tags: ['a', 'b'] });

    expect(a.download).toBe('测试_标题.md');
    expect(clickSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
