'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { useUIStore } from '@/stores/ui-store';
import type { NavSection } from '@/config/navigation';

/** ⌘K / Ctrl-K global command palette + search. Navigates via the same config as the sidebar. */
export function CommandPalette({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const { commandOpen, setCommandOpen, toggleCommand } = useUIStore();

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

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search pages, jump anywhere…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
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
