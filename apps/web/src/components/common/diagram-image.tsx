'use client';
/**
 * @file diagram-image.tsx
 * Renders a question's linked engineering diagram (SVG or raster, served as a
 * URL or data URI). Responsive by default (scales to its container without
 * losing vector sharpness); click to view at full size without upscaling
 * artifacts. Shows caption/alt text beneath when present.
 */
import { useState } from 'react';

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
  if (!diagram) return null;

  return (
    <figure className={`my-3 ${className ?? ''}`}>
      <button
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
          role="dialog"
          aria-modal="true"
          aria-label={diagram.title}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
          onClick={() => setExpanded(false)}
        >
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
