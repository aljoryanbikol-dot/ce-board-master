import { FoundationPageView } from '@/features/handbook/components/foundation-page';

export const metadata = { title: 'Engineering Foundations' };

export default async function FoundationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FoundationPageView publicId={decodeURIComponent(id)} />;
}
