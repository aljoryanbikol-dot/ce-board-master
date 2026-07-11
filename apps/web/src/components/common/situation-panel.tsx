'use client';
/**
 * @file situation-panel.tsx — shared renderer for PRC-style situational sets.
 *
 * A situation is one scenario shared by several consecutive questions
 * (Situation N → Question 1..k of k). The panel shows the scenario text,
 * given data, and the shared figure ONCE per question view, with a
 * "Question X of Y" chip so students track their place in the set without
 * re-reading the situation.
 */
import { MathText } from '@/components/common/math-text';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';

export interface SituationData {
  publicId: string;
  number: number;
  text: string;
  givenData?: Record<string, string> | null;
  category?: string | null;
  questionIndex: number;
  questionCount: number;
  figure?: { imageUrl: string; title?: string | null; altText?: string | null } | null;
}

export function SituationPanel({ situation, compact }: { situation?: SituationData | null; compact?: boolean }) {
  if (!situation) return null;
  const given = situation.givenData && typeof situation.givenData === 'object'
    ? Object.entries(situation.givenData)
    : [];
  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge className="gap-1"><Layers className="h-3 w-3" /> Situation {situation.number}</Badge>
        <Badge variant="muted">Question {situation.questionIndex} of {situation.questionCount}</Badge>
        {situation.category ? <span className="text-2xs uppercase tracking-wider text-muted-foreground">{situation.category}</span> : null}
      </div>
      <p className="text-sm leading-relaxed"><MathText text={situation.text} /></p>
      {given.length > 0 && !compact ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          {given.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="font-mono text-muted-foreground">{k}:</dt>
              <dd className="font-mono font-medium"><MathText text={String(v)} /></dd>
            </div>
          ))}
        </dl>
      ) : null}
      {situation.figure ? (
        <div className="mt-3 overflow-hidden rounded-md border bg-white p-2">
          {/* Situation figures are self-contained SVG data URIs from the Library. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={situation.figure.imageUrl} alt={situation.figure.altText ?? situation.figure.title ?? 'Situation figure'} className="mx-auto max-h-80 w-auto max-w-full" />
        </div>
      ) : null}
    </div>
  );
}
