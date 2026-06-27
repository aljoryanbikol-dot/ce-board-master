import { ExamRunner } from '@/features/exams/components/exam-runner';
export default async function ExamTakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamRunner examId={id} />;
}
