import { getAllArticles } from '@/lib/articles';
import LibraryClient from './LibraryClient';

export default function LibraryPage() {
  const articles = getAllArticles();
  return <LibraryClient articles={articles} />;
}
