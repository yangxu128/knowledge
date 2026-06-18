import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <AdminClient user={user} />;
}
