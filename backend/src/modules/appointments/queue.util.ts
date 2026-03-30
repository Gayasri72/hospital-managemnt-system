// ──────────────────────────────────────────────────────────────────────────────
// Queue Utility — queue number display formatting.
//
// Queue number assignment comes from slot_number (pre-numbered during
// slot generation). This utility only handles display formatting.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Format a queue number for display.
 *
 * @example formatQueueDisplay(1)  → 'Q001'
 * @example formatQueueDisplay(12) → 'Q012'
 * @example formatQueueDisplay(5)  → 'Q005'
 */
export function formatQueueDisplay(queueNumber: number): string {
  return `Q${String(queueNumber).padStart(3, '0')}`;
}
