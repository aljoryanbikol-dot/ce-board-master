'use client';
/**
 * @file diagram-image.tsx
 * Renders a question's linked engineering diagram (SVG or raster, served as a
 * URL or data URI). Responsive by default (scales to its container without
 * losing vector sharpness); click to view at full size without upscaling
 * artifacts. Shows caption/alt text beneath when present.
 */
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export interface DiagramImageData {
  publicId: string;
  title: string;
  imageUrl: string;
  altText: string;
  caption?: string | null;
  description?: string | null;
}

export function DiagramImage({ diagram, className }: { diagram?: DiagramImageData | null; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keyboard-only users can open the lightbox but were previously unable to
  // close it (no Escape handler) or reach it via focus (no focus management) —
  // move focus into the dialog on open, restore it to the trigger on close.
  useEffect(() => {
    if (!expanded) return;
    dialogRef.current?.focus();
    const trigger = triggerRef.current;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [expanded]);

  if (!diagram) return null;

  return (
    <figure className={`my-3 ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setExpanded(true)}
        className="block w-full cursor-zoom-in rounded-md border bg-white p-2"
        aria-label={`Enlarge diagram: ${diagram.altText}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URIs aren't compatible with next/image optimization */}
        <img
          src={diagram.imageUrl}
          alt={diagram.altText}
          className="mx-auto max-h-80 w-auto max-w-full object-contain"
          loading="lazy"
        />
      </button>
      {diagram.caption && <figcaption className="mt-1 text-center text-xs text-muted-foreground">{diagram.caption}</figcaption>}

      {expanded && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={diagram.title}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6 outline-none"
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URIs aren't compatible with next/image optimization */}
          <img
            src={diagram.imageUrl}
            alt={diagram.altText}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </figure>
  );
}
