import Link from 'next/link';
import type { ReactNode } from 'react';
import { Ruler } from 'lucide-react';
import { config } from '@/lib/config';

/**
 * The auth shell: a split surface. Left is the branded blueprint panel (the
 * signature grid + a structural thesis line); right hosts the form. Collapses
 * to a single column on mobile.
 */
export function AuthShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / blueprint panel */}
      <div className="surface-blueprint relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="absolute inset-0 bg-primary/85" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <Ruler className="h-6 w-6" />
            {config.appName}
          </Link>
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-3xl font-semibold leading-tight">
            Build your license on a solid foundation.
          </p>
          <p className="mt-4 text-sm text-primary-foreground/80">
            Practice, mock boards, and an AI tutor grounded in the PRC Civil Engineering syllabus — engineered for the people who engineer everything else.
          </p>
        </div>
        <div className="relative font-mono text-2xs uppercase tracking-widest text-primary-foreground/60">
          PRC CE Licensure · Review Platform
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-bold">
              <Ruler className="h-5 w-5 text-primary" />
              {config.appName}
            </Link>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
