import { describe, it, expect } from 'vitest';
import { parseFrontmatter, timeAgo } from '../src/lib/shared';

describe('parseFrontmatter', () => {
  it('解析标准 frontmatter', () => {
    const content = `---
title: 测试标题
tags: ['a', 'b']
category: 技术
---

正文内容`;
    const { meta, body } = parseFrontmatter(content);
    expect(meta.title).toBe('测试标题');
    expect(meta.tags).toEqual(['a', 'b']);
    expect(meta.category).toBe('技术');
    expect(body.trim()).toBe('正文内容');
  });

  it('无 frontmatter 时返回原文', () => {
    const content = '# 标题\n正文';
    const { meta, body } = parseFrontmatter(content);
    expect(meta).toEqual({});
    expect(body).toBe(content);
  });

  it('解析双引号数组', () => {
    const content = `---
tags: ["x", "y"]
---
body`;
    const { meta } = parseFrontmatter(content);
    expect(meta.tags).toEqual(['x', 'y']);
  });

  it('解析失败时回退为逗号分割', () => {
    const content = `---
tags: [a, b, c]
---
body`;
    const { meta } = parseFrontmatter(content);
    expect(meta.tags).toEqual(['a', 'b', 'c']);
  });

  it('空内容不崩溃', () => {
    const { meta, body } = parseFrontmatter('');
    expect(meta).toEqual({});
    expect(body).toBe('');
  });
});

describe('timeAgo', () => {
  it('刚刚', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('刚刚');
  });

  it('分钟前', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toMatch(/分钟前/);
  });

  it('小时前', () => {
    const d = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(timeAgo(d)).toMatch(/小时前/);
  });

  it('天前', () => {
    const d = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
    expect(timeAgo(d)).toMatch(/天前/);
  });
});
