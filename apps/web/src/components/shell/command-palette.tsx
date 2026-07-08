'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sigma } from 'lucide-react';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { useUIStore } from '@/stores/ui-store';
import { handbookApi } from '@/features/handbook/api/handbook-api';
import type { NavSection } from '@/config/navigation';

/**
 * ⌘K / Ctrl-K global command palette + smart search. Navigates pages via the
 * same config as the sidebar, and live-searches the Fundamentals Handbook
 * formula library (name / expression / application text) once 2+ characters
 * are typed — the "search anything" entry point.
 */
export function CommandPalette({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { commandOpen, setCommandOpen, toggleCommand } = useUIStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommand();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCommand]);

  // Handbook formula results — student portal only (the admin palette stays nav-only).
  const isStudentPortal = !pathname.startsWith('/admin');
  const formulaSearch = useQuery({
    queryKey: ['palette', 'formulas', query],
    queryFn: () => handbookApi.formulas({ q: query, limit: 6 }),
    enabled: commandOpen && isStudentPortal && query.trim().length >= 2,
    staleTime: 30_000,
  });
  const formulaHits = formulaSearch.data?.items ?? [];

  const go = (href: string) => {
    setCommandOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search pages, formulas, symbols…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {formulaHits.length > 0 ? (
          <CommandGroup heading="Formulas">
            {formulaHits.map((f) => (
              <CommandItem key={f.slug} value={`${f.name} ${f.expressionText}`} onSelect={() => go(`/handbook/formula/${f.slug}`)}>
                <Sigma className="h-4 w-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="ml-2 shrink-0 font-mono text-2xs text-muted-foreground">{f.subject.code}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {sections.map((section) => (
          <CommandGroup key={section.label} heading={section.label}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
