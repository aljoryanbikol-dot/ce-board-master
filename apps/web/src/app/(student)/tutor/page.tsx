import type { Metadata } from 'next';
import { TutorChat } from '@/features/tutor/components/tutor-chat';
export const metadata: Metadata = { title: 'AI Tutor' };
export default function TutorPage() { return <TutorChat />; }
