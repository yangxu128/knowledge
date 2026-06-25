import type { MetadataRoute } from 'next';
import { getAllArticles } from '@/lib/articles';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://knowledge.example.com';
  const staticPages = ['', '/explore', '/library', '/graph', '/review', '/search', '/import'].map(p => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : 0.7,
  }));
  const articles = getAllArticles().map(a => ({
    url: `${base}/knowledge/${a.slug}`,
    lastModified: new Date(a.updated || a.published || Date.now()),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));
  return [...staticPages, ...articles];
}
