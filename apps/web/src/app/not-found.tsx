import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="text-center">
        <p className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">Error 404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">This page isn't on the blueprint</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or was moved.</p>
        <Button asChild className="mt-6"><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
