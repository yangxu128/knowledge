import { getAllArticles } from '@/lib/articles';
import HomeClient from './HomeClient';

export const revalidate = 3600;

export default async function Home() {
  const articles = await getAllArticles();
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
