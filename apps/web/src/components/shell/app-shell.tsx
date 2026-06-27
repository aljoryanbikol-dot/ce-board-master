'use client';
import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { MobileNav } from './mobile-nav';
import { CommandPalette } from './command-palette';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import type { NavSection } from '@/config/navigation';

/** The authenticated app frame: rail + topbar + command palette + error-bounded content. */
export function AppShell({ sections, homeHref, children }: { sections: NavSection[]; homeHref?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar sections={sections} homeHref={homeHref} />
      <MobileNav sections={sections} homeHref={homeHref} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
      <CommandPalette sections={sections} />
    </div>
  );
}
