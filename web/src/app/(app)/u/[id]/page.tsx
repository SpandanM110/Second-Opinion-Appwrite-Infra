import { ProfilePage } from '@/views/ProfilePage';

export const metadata = { title: 'Profile' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ProfilePage id={(await params).id} />;
}
