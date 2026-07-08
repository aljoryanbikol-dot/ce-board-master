import { ReviewSheetView } from '@/features/handbook/components/review-sheet';

export const metadata = { title: 'Quick Review Sheet' };

export default async function SheetPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ReviewSheetView subjectCode={code} />;
}
