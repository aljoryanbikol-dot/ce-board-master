import type { Metadata } from 'next';
import { ExamsList } from '@/features/exams/components/exams-list';
export const metadata: Metadata = { title: 'Mock Exams' };
export default function ExamsPage() { return <ExamsList />; }
