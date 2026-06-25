import { getAllArticles } from '@/lib/articles';
import GraphClient from './GraphClient';

export default async function GraphPage() {
  const articles = await getAllArticles();
  return <GraphClient articles={articles} />;
}
