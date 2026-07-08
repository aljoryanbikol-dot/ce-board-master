import { Suspense } from 'react';
import type { Metadata } from 'next';
import { TutorChat } from '@/features/tutor/components/tutor-chat';
import { LoadingState } from '@/components/ui/spinner';
export const metadata: Metadata = { title: 'AI Tutor' };
// Suspense boundary: TutorChat reads the ?ask= query param (Handbook deep links).
export default function TutorPage() { return <Suspense fallback={<LoadingState />}><TutorChat /></Suspense>; }
