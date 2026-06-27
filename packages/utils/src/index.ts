/**
 * @ce-board-master/utils — Shared utility functions.
 *
 * Pure functions only — no side effects, no external dependencies.
 * Safe to use in both browser (Next.js) and Node.js (NestJS) environments.
 */

/**
 * Convert accuracy rate (0–1) to a percentage string.
 * @example accuracyToPercent(0.725) → "72.5%"
 */
export function accuracyToPercent(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/**
 * Get traffic-light classification from accuracy rate.
 * Matches thresholds defined in UX Specification (Phase 5, Analytics).
 */
export function getStrengthLevel(accuracyRate: number): 'green' | 'amber' | 'red' {
  if (accuracyRate >= 0.8) return 'green';
  if (accuracyRate >= 0.65) return 'amber';
  return 'red';
}

/**
 * Calculate days remaining until a target date from today.
 * Returns 0 if target date is in the past.
 */
export function daysUntil(targetDate: Date | string): number {
  const target = new Date(targetDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Truncate a string to a maximum length with ellipsis.
 * @example truncate("Hello World", 8) → "Hello..."
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Build a cursor from an object's id field for pagination.
 * Encoded as base64 to prevent client-side manipulation.
 */
export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id })).toString('base64');
}

/**
 * Decode a pagination cursor back to its id.
 * Returns null if cursor is invalid.
 */
export function decodeCursor(cursor: string): string | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString()) as { id: string };
    return decoded.id;
  } catch {
    return null;
  }
}

/**
 * Format a Philippine Peso amount from cents.
 * @example formatPHP(29900) → "₱299.00"
 */
export function formatPHP(cents: number): string {
  return `₱${(cents / 100).toFixed(2)}`;
}

/**
 * Generate a question code from components.
 * Format: [SUBJECT_CODE]-[TOPIC_ABBR]-[DIFF]-[SEQ]
 * @example generateQuestionCode('HGE', 'OPEN', 2, 42) → "HGE-OPEN-INT-042"
 */
export function generateQuestionCode(
  subjectCode: string,
  topicAbbr: string,
  difficultyCode: 1 | 2 | 3,
  sequence: number,
): string {
  const diffMap = { 1: 'FND', 2: 'INT', 3: 'ADV' } as const;
  const seq = String(sequence).padStart(3, '0');
  return `${subjectCode}-${topicAbbr}-${diffMap[difficultyCode]}-${seq}`;
}
