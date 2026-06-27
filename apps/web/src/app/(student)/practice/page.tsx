import type { Metadata } from 'next';
import { PracticeView } from '@/features/practice/components/practice-view';
export const metadata: Metadata = { title: 'Practice' };
export default function PracticePage() { return <PracticeView />; }
