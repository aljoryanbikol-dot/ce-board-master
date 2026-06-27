'use client';
import { Bookmark } from 'lucide-react';
import { useBookmarks } from '@/features/student/hooks/use-student';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/query-boundary';
import { Card, CardContent } from '@/components/ui/card';

export default function BookmarksPage() {
  const bookmarks = useBookmarks();
  const items = (bookmarks.data as Array<{ id: string; questionCode?: string; stemPreview?: string }> | undefined) ?? [];
  return (
    <div>
      <PageHeader title="Bookmarks" description="Questions you saved to revisit." />
      <QueryBoundary isLoading={bookmarks.isLoading} isError={bookmarks.isError} isEmpty={items.length === 0} emptyTitle="No bookmarks yet" emptyDescription="Tap the bookmark icon on any question to save it here.">
        <Card><CardContent className="divide-y p-0">
          {items.map((b) => (
            <div key={b.id} className="flex items-start gap-3 px-6 py-4 text-sm">
              <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div><p className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">{b.questionCode ?? b.id.slice(0, 8)}</p><p className="mt-0.5">{b.stemPreview ?? 'Saved question'}</p></div>
            </div>
          ))}
        </CardContent></Card>
      </QueryBoundary>
    </div>
  );
}
