'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import type { NavSection } from '@/config/navigation';

export function MobileNav({ sections, homeHref = '/dashboard' }: { sections: NavSection[]; homeHref?: string }) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const isActive = (href: string) => (href === homeHref || href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <Dialog open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <DialogContent className="left-0 top-0 h-full max-w-xs translate-x-0 translate-y-0 rounded-none border-r data-[state=open]:animate-fade-in">
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <nav className="overflow-y-auto">
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              <p className="px-1 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm', active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-secondary')}
                      >
                        <Icon className="h-4 w-4" />{item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
