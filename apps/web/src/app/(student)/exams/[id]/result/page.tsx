import { ExamResultView } from '@/features/exams/components/exam-result';
export default async function ExamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamResultView examId={id} />;
}
