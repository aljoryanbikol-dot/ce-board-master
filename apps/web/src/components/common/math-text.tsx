'use client';
/**
 * @file math-text.tsx
 * Renders text containing KaTeX math: `$$…$$` (block) and `$…$` (inline) are
 * rendered with KaTeX; everything else is plain text (whitespace preserved).
 * Used for live preview in the question editor and for rendering stems/explanations.
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';

function render(expr: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expr, { displayMode, throwOnError: false });
  } catch {
    return expr;
  }
}

export function MathText({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  const parts = text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  return (
    <span className={`whitespace-pre-wrap ${className ?? ''}`}>
      {parts.map((p, i) => {
        if (p.startsWith('$$') && p.endsWith('$$') && p.length > 4) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: render(p.slice(2, -2), true) }} />;
        }
        if (p.startsWith('$') && p.endsWith('$') && p.length > 2) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: render(p.slice(1, -1), false) }} />;
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}
