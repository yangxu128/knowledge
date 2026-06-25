import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/login'] },
    sitemap: 'https://knowledge.example.com/sitemap.xml',
  };
}
