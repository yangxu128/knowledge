import { getAllArticles } from '@/lib/articles';
import HomeClient from './HomeClient';

export default function Home() {
  const articles = getAllArticles();
  const serverArticles = articles.map(a => ({
    slug: a.slug,
    title: a.title,
    description: a.description,
    tags: a.tags,
    category: a.category,
    published: a.published,
    author: a.author,
  }));
  return <HomeClient articles={serverArticles} />;
}
