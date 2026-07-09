'use client';
/**
 * @file math-text.tsx
 * Renders text containing KaTeX math: `$$…$$` (block) and `$…$` (inline) are
 * rendered with KaTeX; everything else is plain text (whitespace preserved).
 * Used for live preview in the question editor and for rendering stems/explanations.
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Some Knowledge Library records carry numeric HTML entities (&#8722; minus,
 * &#963; sigma, superscripts, …) in plain-text fields. Decode them to their
 * Unicode characters before display — numeric entities only plus a small safe
 * named set, never markup, so this cannot inject HTML.
 */
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', deg: '°', times: '×', middot: '·', plusmn: '±', minus: '−', radic: '√' };
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/g, (m, n: string) => NAMED[n] ?? m);
}

function render(expr: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expr, { displayMode, throwOnError: false });
  } catch {
    return expr;
  }
}

export function MathText({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  const parts = decodeEntities(text).split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
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
