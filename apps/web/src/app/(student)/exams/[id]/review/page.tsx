import { ExamReviewView } from '@/features/exams/components/exam-review';

export const metadata = { title: 'Exam Review' };

export default async function ExamReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamReviewView examId={id} />;
}
