import type { Metadata } from 'next';
import { ProgressView } from '@/features/student/components/progress-view';
export const metadata: Metadata = { title: 'Progress' };
export default function ProgressPage() { return <ProgressView />; }
