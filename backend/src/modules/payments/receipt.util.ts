// ──────────────────────────────────────────────────────────────────────────────
// Receipt Utility — pure functions for formatting receipt data.
//
// RULES:
// - No database calls. Pure data transformation only.
// - Fee values come from the payment row (originally
//   snapshotted from the appointment row). Never recalculated.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Format a currency amount for display.
 * @example formatCurrency(2500.00) → 'Rs. 2,500.00'
 */
export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate a receipt number from a payment_id.
 * Takes the last 8 characters of the UUID, uppercased.
 * @example formatReceiptNumber('550e8400-e29b-41d4-a716-446655440099') → 'RCP-55440099'
 */
export function formatReceiptNumber(paymentId: string): string {
  const suffix = paymentId.replace(/-/g, '').slice(-8).toUpperCase();
  return `RCP-${suffix}`;
}

/**
 * Assemble a complete receipt data object from payment + appointment data.
 *
 * This is a pure function — pass in all the data it needs.
 * Frontend uses this to render a printable receipt.
 */
export function buildReceiptData(
  payment: {
    payment_id: string;
    total_amount: number;
    doctor_amount: number;
    hospital_amount: number;
    amount_paid: number;
    status: string;
    created_at: Date;
  },
  appointment: {
    appointment_id: string;
    queue_number: number;
    session?: {
      session_date: Date;
      start_time?: string;
      branch?: { name: string; location?: string };
    } | null;
    slot?: { slot_time: string } | null;
    patient: { name: string; nic?: string | null; phone: string };
    doctor: { name: string; specialization: string };
  },
  transactions: Array<{
    transaction_id: string;
    method: string;
    amount: number;
    direction: string;
    reference?: string | null;
    note?: string | null;
    processed_by: string;
    created_at: Date;
  }>,
  hospital?: { name: string; address?: string | null; contact_number?: string | null },
) {
  const balanceRemaining = payment.total_amount - payment.amount_paid;

  return {
    receipt_number: formatReceiptNumber(payment.payment_id),
    issued_at: new Date().toISOString(),

    hospital: hospital
      ? {
          name: hospital.name,
          address: hospital.address || '',
          contact_number: hospital.contact_number || '',
        }
      : null,

    patient: {
      name: appointment.patient.name,
      nic: appointment.patient.nic || '',
      phone: appointment.patient.phone,
    },

    doctor: {
      name: appointment.doctor.name,
      specialization: appointment.doctor.specialization,
    },

    appointment: {
      appointment_id: appointment.appointment_id,
      date: appointment.session?.session_date || null,
      time: appointment.slot?.slot_time || null,
      queue_display: `Q${String(appointment.queue_number).padStart(3, '0')}`,
      branch: appointment.session?.branch?.name || '',
    },

    fee_breakdown: {
      doctor_fee: payment.doctor_amount,
      hospital_charge: payment.hospital_amount,
      total: payment.total_amount,
      doctor_fee_display: formatCurrency(payment.doctor_amount),
      hospital_charge_display: formatCurrency(payment.hospital_amount),
      total_display: formatCurrency(payment.total_amount),
    },

    payment_summary: {
      amount_paid: payment.amount_paid,
      amount_paid_display: formatCurrency(payment.amount_paid),
      balance_remaining: balanceRemaining,
      balance_remaining_display: formatCurrency(balanceRemaining),
      status: payment.status,
    },

    transactions: transactions.map((tx) => ({
      transaction_id: tx.transaction_id,
      method: tx.method,
      amount: tx.amount,
      amount_display: formatCurrency(tx.amount),
      direction: tx.direction,
      reference: tx.reference || '',
      note: tx.note || '',
      timestamp: tx.created_at,
    })),
  };
}
