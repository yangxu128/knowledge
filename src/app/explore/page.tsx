import { getAllArticles } from '@/lib/articles';
import ExploreClient from './ExploreClient';

export default async function ExplorePage() {
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
  return <ExploreClient serverArticles={serverArticles} />;
}
