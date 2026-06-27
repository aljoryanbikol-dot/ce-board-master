'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
import { config } from '@/lib/config';
import type { NavSection } from '@/config/navigation';

/** The persistent left rail. Active state derives from the pathname. */
export function Sidebar({ sections, homeHref = '/dashboard' }: { sections: NavSection[]; homeHref?: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === homeHref || href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Link href={homeHref} className="inline-flex items-center gap-2 font-display text-base font-bold tracking-tight">
          <Ruler className="h-5 w-5 text-primary" />
          {config.appName}
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
