/**
 * @file document-parser.service.ts
 * @module Knowledge/Services
 *
 * DocumentParserService — pure text → structured document parsing for ingestion.
 * Takes the extracted plain text of an enterprise document and produces:
 *  - a stable SHA-256 content checksum (so re-ingestion is idempotent),
 *  - a word count,
 *  - parsed sections keyed by heading (for the full-text index + cross-ref
 *    anchoring).
 *
 * The parser is deliberately format-tolerant: it recognizes the markdown-style
 * headings produced by docx text extraction (e.g. "**Chapter 1**", "1.1 Title",
 * "**4.2 Identifier Structure**") and groups body text beneath them. No DB
 * access; fully deterministic and unit-testable.
 */
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SECTION_MIN_WORDS } from '../constants/knowledge.constants';
import type { ParsedDocument, ParsedSection } from '../types/knowledge.types';

@Injectable()
export class DocumentParserService {
  /** Heading detectors, in priority order. */
  private static readonly HEADING_PATTERNS: RegExp[] = [
    /^\*\*(Chapter\s+\d+)\*\*$/i,                 // **Chapter 3**
    /^\*\*(\d+(?:\.\d+)*)\s+(.+?)\*\*$/,          // **4.2 Identifier Structure**
    /^(\d+(?:\.\d+)+)\s+(.{2,120})$/,             // 4.2 Identifier Structure
    /^\*\*([A-Z][A-Za-z0-9 &/\-]{2,120})\*\*$/,   // **Validation Rules**
  ];

  parse(rawText: string): ParsedDocument {
    const normalized = rawText.replace(/\r\n/g, '\n').trim();
    const checksum = createHash('sha256').update(normalized).digest('hex');
    const wordCount = this.countWords(normalized);
    const sections = this.extractSections(normalized);
    return { contentText: normalized, contentChecksum: checksum, wordCount, sections };
  }

  /** Compute only the checksum (used to detect duplicate ingestion cheaply). */
  checksum(rawText: string): string {
    return createHash('sha256').update(rawText.replace(/\r\n/g, '\n').trim()).digest('hex');
  }

  private extractSections(text: string): ParsedSection[] {
    const lines = text.split('\n');
    const sections: ParsedSection[] = [];
    let current: { heading: string; level: number; body: string[] } | null = null;
    let order = 0;

    const pushCurrent = () => {
      if (!current) return;
      const bodyText = current.body.join('\n').trim();
      const wc = this.countWords(bodyText);
      if (current.heading && (wc >= SECTION_MIN_WORDS || sections.length === 0 || current.body.length > 0)) {
        sections.push({
          anchor: this.slugifyAnchor(current.heading, order),
          heading: current.heading,
          level: current.level,
          orderIndex: order,
          bodyText,
          wordCount: wc,
        });
        order++;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { if (current) current.body.push(''); continue; }
      const detected = this.detectHeading(line);
      if (detected) {
        pushCurrent();
        current = { heading: detected.heading, level: detected.level, body: [] };
      } else if (current) {
        current.body.push(line);
      } else {
        // Preamble before the first heading becomes an implicit "Preamble" section.
        current = { heading: 'Preamble', level: 1, body: [line] };
      }
    }
    pushCurrent();
    return sections;
  }

  private detectHeading(line: string): { heading: string; level: number } | null {
    for (const pattern of DocumentParserService.HEADING_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        if (m.length >= 3 && m[2]) {
          const numbering = m[1] ?? '';
          const level = (numbering.match(/\./g)?.length ?? 0) + 1;
          return { heading: `${m[1]} ${m[2]}`.trim(), level: Math.min(level, 6) };
        }
        return { heading: m[1]!.trim(), level: 1 };
      }
    }
    return null;
  }

  private slugifyAnchor(heading: string, order: number): string {
    const base = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
    return base ? `${order}-${base}` : `section-${order}`;
  }

  private countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }
}
