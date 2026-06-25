import { redirect } from 'next/navigation';

export default async function ImportedPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (id) redirect(`/knowledge/${id}`);
  redirect('/library');
}
