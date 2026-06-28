'use client';
/**
 * @file markdown-math.tsx
 * Renders Markdown + KaTeX math (GitHub-flavored). Inline math `$…$`, block math
 * `$$…$$`, tables, lists, and images by URL (`![alt](https://…)`) all render —
 * so engineering diagrams can be embedded inline in stems/explanations today,
 * while the structured QuestionImage relation remains available for a future slice.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export function MarkdownMath({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert [&_img]:my-2 [&_img]:max-h-80 [&_img]:rounded-md [&_img]:border [&_table]:text-sm ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
