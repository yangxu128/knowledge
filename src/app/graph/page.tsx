import { getAllArticles } from '@/lib/articles';
import GraphClient from './GraphClient';

export default function GraphPage() {
  const articles = getAllArticles();
  return <GraphClient articles={articles} />;
}
