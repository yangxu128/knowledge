import { getAllArticles } from '@/lib/articles';
import LibraryClient from './LibraryClient';

export default async function LibraryPage() {
  const articles = await getAllArticles();
  return <LibraryClient articles={articles} />;
}
