// ──────────────────────────────────────────────────────────────────────────────
// Slot Utility — pure slot generation logic for channel sessions.
//
// No DB calls here. This is pure time arithmetic.
// Returns an array of slot objects ready for bulk INSERT.
// ──────────────────────────────────────────────────────────────────────────────

export interface SlotData {
  session_id: string;
  slot_number: number;
  slot_time: string;   // HH:MM
  is_booked: boolean;
}

/**
 * Convert HH:MM string to total minutes since midnight.
 * @example timeToMinutes('18:30') → 1110
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

/**
 * Convert total minutes since midnight to HH:MM string.
 * @example minutesToTime(1110) → '18:30'
 */
export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Auto-calculate max_patients when not provided.
 *
 * @example calculateMaxPatients('18:00', '21:00', 10) → 18
 * @example calculateMaxPatients('18:00', '21:00', 15) → 12
 */
export function calculateMaxPatients(
  startTime: string,
  endTime: string,
  slotDuration: number,
): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return Math.floor((endMinutes - startMinutes) / slotDuration);
}

/**
 * Generate slot data for a session.
 *
 * Each slot gets a sequential number and a calculated start time.
 * slot_time = start_time + (slot_number - 1) * slot_duration
 *
 * @example
 * generateSlots('uuid', '18:00', 10, 5)
 * → [
 *     { session_id: 'uuid', slot_number: 1, slot_time: '18:00', is_booked: false },
 *     { session_id: 'uuid', slot_number: 2, slot_time: '18:10', is_booked: false },
 *     { session_id: 'uuid', slot_number: 3, slot_time: '18:20', is_booked: false },
 *     { session_id: 'uuid', slot_number: 4, slot_time: '18:30', is_booked: false },
 *     { session_id: 'uuid', slot_number: 5, slot_time: '18:40', is_booked: false },
 *   ]
 */
export function generateSlots(
  sessionId: string,
  startTime: string,
  slotDuration: number,
  maxPatients: number,
): SlotData[] {
  const startMinutes = timeToMinutes(startTime);
  const slots: SlotData[] = [];

  for (let i = 0; i < maxPatients; i++) {
    slots.push({
      session_id: sessionId,
      slot_number: i + 1,
      slot_time: minutesToTime(startMinutes + i * slotDuration),
      is_booked: false,
    });
  }

  return slots;
}
