import { FormulaDetailView } from '@/features/handbook/components/formula-detail';

export const metadata = { title: 'Formula Reference' };

export default async function FormulaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FormulaDetailView slug={slug} />;
}
