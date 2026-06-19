export interface ArticleSummary {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  published: string;
  author: string;
  isImported?: boolean;
}

export const tagColors = [
  'bg-accent-light text-accent', 'bg-sage-light text-sage', 'bg-sand-light text-sand',
  'bg-blue-50 text-blue-600', 'bg-purple-50 text-purple-600', 'bg-amber-50 text-amber-600',
];

export const categoryColors: Record<string, { bg: string; text: string }> = {
  '技术文档': { bg: 'bg-sage-light', text: 'text-sage' },
  '最佳实践': { bg: 'bg-accent-light', text: 'text-accent' },
  '方法论': { bg: 'bg-sand-light', text: 'text-sand' },
  '导入知识': { bg: 'bg-blue-50', text: 'text-blue-600' },
  '网页收藏': { bg: 'bg-purple-50', text: 'text-purple-600' },
};

export const iconMap: Record<string, string> = {
  'EdgeOne': 'fa-cloud', '部署': 'fa-rocket', '前端': 'fa-code',
  '边缘计算': 'fa-server', 'Serverless': 'fa-bolt', '存储': 'fa-database',
  '数据库': 'fa-database', '性能': 'fa-tachometer-alt', 'CDN': 'fa-globe',
  '知识管理': 'fa-brain', '效率': 'fa-lightbulb', '方法论': 'fa-compass',
};

export function timeAgo(dateStr: string): string {
  const now = new Date();
  let d: Date;
  if (dateStr.includes('T') || dateStr.endsWith('Z')) {
    d = new Date(dateStr);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    d = new Date(dateStr + 'T00:00:00Z');
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return '';
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString('zh-CN');
}

export function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {} as Record<string, unknown>, body: content };
  const meta: Record<string, unknown> = {};
  match[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    let val: string | string[];
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try { val = JSON.parse(raw.replace(/'/g, '"')) as string[]; } catch {
        val = raw.slice(1, -1).split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    } else {
      val = raw;
    }
    meta[key] = val;
  });
  return { meta, body: content.slice(match[0].length) };
}
