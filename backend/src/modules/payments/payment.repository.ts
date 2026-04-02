// ──────────────────────────────────────────────────────────────────────────────
// Payment Repository — all database queries and transactions.
//
// RULES:
// - All queries scoped by hospital_id
// - Fee values read from appointments row (snapshot), never recalculated
// - Transaction insert + payment update always in one DB transaction
// - payment_transactions are immutable — never UPDATE or DELETE
// - All money stored as DECIMAL(10,2)
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';
import type { Prisma } from '@prisma/client';

// ── Create Payment ───────────────────────────────────────────────────────────

export async function createPayment(data: {
  appointment_id: string;
  hospital_id: string;
  total_amount: number;
  doctor_amount: number;
  hospital_amount: number;
}) {
  return prisma.payment.create({
    data: {
      appointment_id: data.appointment_id,
      hospital_id: data.hospital_id,
      total_amount: data.total_amount,
      doctor_amount: data.doctor_amount,
      hospital_amount: data.hospital_amount,
      amount_paid: 0,
      status: 'pending',
    },
    include: {
      appointment: {
        select: {
          appointment_id: true,
          queue_number: true,
          patient: { select: { name: true, nic: true, phone: true } },
          doctor: { select: { name: true, specialization: true } },
          session: {
            select: {
              session_date: true,
              start_time: true,
              branch: { select: { name: true } },
            },
          },
          slot: { select: { slot_time: true } },
        },
      },
    },
  });
}

// ── Add Transaction (Credit — Payment In) ────────────────────────────────────

/**
 * Insert a credit transaction and update payment totals.
 * All inside one DB transaction.
 */
export async function addTransaction(
  paymentId: string,
  hospitalId: string,
  data: {
    method: string;
    amount: number;
    reference?: string;
    note?: string;
    processed_by: string;
  },
  currentAmountPaid: number,
  totalAmount: number,
) {
  const newAmountPaid = currentAmountPaid + data.amount;

  let newStatus: string;
  if (newAmountPaid >= totalAmount) {
    newStatus = 'paid';
  } else if (newAmountPaid > 0) {
    newStatus = 'partial';
  } else {
    newStatus = 'pending';
  }

  return prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.create({
      data: {
        payment_id: paymentId,
        hospital_id: hospitalId,
        method: data.method,
        amount: data.amount,
        direction: 'credit',
        reference: data.reference || null,
        note: data.note || null,
        processed_by: data.processed_by,
      },
    });

    return tx.payment.update({
      where: { payment_id: paymentId },
      data: {
        amount_paid: newAmountPaid,
        status: newStatus,
      },
      include: {
        transactions: { orderBy: { created_at: 'asc' } },
        appointment: {
          select: {
            appointment_id: true,
            queue_number: true,
            patient: { select: { name: true, nic: true, phone: true } },
            doctor: { select: { name: true, specialization: true } },
            session: {
              select: {
                session_date: true,
                start_time: true,
                branch: { select: { name: true } },
              },
            },
            slot: { select: { slot_time: true } },
          },
        },
      },
    });
  });
}

// ── Add Refund (Debit — Payment Out) ─────────────────────────────────────────

/**
 * Insert a debit transaction and update payment totals.
 * All inside one DB transaction.
 */
export async function addRefund(
  paymentId: string,
  hospitalId: string,
  data: {
    method: string;
    amount: number;
    reason: string;
    reference?: string;
    processed_by: string;
  },
  currentAmountPaid: number,
) {
  const newAmountPaid = currentAmountPaid - data.amount;

  const newStatus = newAmountPaid <= 0 ? 'refunded' : 'partial';

  return prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.create({
      data: {
        payment_id: paymentId,
        hospital_id: hospitalId,
        method: data.method,
        amount: data.amount,
        direction: 'debit',
        reference: data.reference || null,
        note: data.reason,
        processed_by: data.processed_by,
      },
    });

    return tx.payment.update({
      where: { payment_id: paymentId },
      data: {
        amount_paid: Math.max(newAmountPaid, 0),
        status: newStatus,
      },
      include: {
        transactions: { orderBy: { created_at: 'asc' } },
        appointment: {
          select: {
            appointment_id: true,
            queue_number: true,
            patient: { select: { name: true, nic: true, phone: true } },
            doctor: { select: { name: true, specialization: true } },
            session: {
              select: {
                session_date: true,
                start_time: true,
                branch: { select: { name: true } },
              },
            },
            slot: { select: { slot_time: true } },
          },
        },
      },
    });
  });
}

// ── Read Queries ─────────────────────────────────────────────────────────────

/**
 * Get payment by ID with all joins.
 */
export async function getPaymentById(paymentId: string, hospitalId: string) {
  return prisma.payment.findFirst({
    where: { payment_id: paymentId, hospital_id: hospitalId },
    include: {
      transactions: {
        orderBy: { created_at: 'asc' },
        include: {
          // We join to users via raw query below for processed_by_name
        },
      },
      appointment: {
        select: {
          appointment_id: true,
          queue_number: true,
          patient: { select: { name: true, nic: true, phone: true } },
          doctor: { select: { name: true, specialization: true } },
          session: {
            select: {
              session_date: true,
              start_time: true,
              branch: { select: { name: true, location: true } },
            },
          },
          slot: { select: { slot_time: true } },
        },
      },
    },
  });
}

/**
 * Get payment by appointment ID.
 */
export async function getPaymentByAppointmentId(appointmentId: string, hospitalId: string) {
  return prisma.payment.findFirst({
    where: { appointment_id: appointmentId, hospital_id: hospitalId },
    include: {
      transactions: { orderBy: { created_at: 'asc' } },
      appointment: {
        select: {
          appointment_id: true,
          queue_number: true,
          status: true,
          patient: { select: { name: true, nic: true, phone: true } },
          doctor: { select: { name: true, specialization: true } },
          session: {
            select: {
              session_date: true,
              start_time: true,
              branch: { select: { name: true, location: true } },
            },
          },
          slot: { select: { slot_time: true } },
        },
      },
    },
  });
}

/**
 * Check if payment exists for an appointment (for duplicate guard).
 */
export async function findPaymentByAppointment(appointmentId: string) {
  return prisma.payment.findUnique({
    where: { appointment_id: appointmentId },
    select: { payment_id: true },
  });
}

/**
 * List payments with filters and pagination.
 */
export async function getPayments(
  hospitalId: string,
  options: {
    status?: string;
    date?: string;
    from?: string;
    to?: string;
    doctor_id?: string;
    method?: string;
    page: number;
    limit: number;
  },
) {
  const { status, date, from, to, doctor_id, method, page, limit } = options;
  const skip = (page - 1) * limit;

  const where: Prisma.PaymentWhereInput = { hospital_id: hospitalId };

  if (status) where.status = status;

  // Date filters via appointment → session
  const appointmentFilter: Prisma.AppointmentWhereInput = {};
  let hasAppointmentFilter = false;

  if (doctor_id) {
    appointmentFilter.doctor_id = doctor_id;
    hasAppointmentFilter = true;
  }

  if (date || from || to) {
    const sessionFilter: Prisma.ChannelSessionWhereInput = {};
    if (date) {
      sessionFilter.session_date = new Date(date);
    } else {
      const dateRange: Record<string, Date> = {};
      if (from) dateRange['gte'] = new Date(from);
      if (to) dateRange['lte'] = new Date(to);
      sessionFilter.session_date = dateRange;
    }
    appointmentFilter.session = sessionFilter;
    hasAppointmentFilter = true;
  }

  if (hasAppointmentFilter) {
    where.appointment = appointmentFilter;
  }

  // Method filter — payment has at least one transaction with this method
  if (method) {
    where.transactions = { some: { method } };
  }

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        appointment: {
          select: {
            appointment_id: true,
            queue_number: true,
            doctor_id: true,
            patient: { select: { name: true, phone: true } },
            doctor: { select: { name: true, specialization: true } },
            session: {
              select: {
                session_date: true,
                branch: { select: { name: true } },
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.payment.count({ where }),
  ]);

  return { data, total, page, limit };
}

// ── Revenue Report Queries ───────────────────────────────────────────────────

/**
 * Daily revenue summary.
 * Aggregates from payment_transactions joined to appointments → sessions.
 */
export async function getDailyRevenue(hospitalId: string, date: string) {
  const targetDate = new Date(date);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // Get all payments for this date
  const payments = await prisma.payment.findMany({
    where: {
      hospital_id: hospitalId,
      appointment: {
        session: {
          session_date: { gte: targetDate, lt: nextDate },
        },
      },
    },
    include: {
      transactions: true,
      appointment: {
        select: {
          patient: { select: { name: true } },
          doctor: { select: { name: true } },
        },
      },
    },
  });

  // Calculate aggregates
  let totalCollected = 0;
  let totalRefunded = 0;
  let doctorRevenue = 0;
  let hospitalRevenue = 0;
  let appointmentsBilled = 0;
  let appointmentsFullyPaid = 0;
  let appointmentsPending = 0;

  const byMethod: Record<string, { count: number; amount: number }> = {
    cash: { count: 0, amount: 0 },
    card: { count: 0, amount: 0 },
    online: { count: 0, amount: 0 },
    insurance: { count: 0, amount: 0 },
  };

  for (const payment of payments) {
    appointmentsBilled++;

    if (payment.status === 'paid') {
      appointmentsFullyPaid++;
      doctorRevenue += Number(payment.doctor_amount);
      hospitalRevenue += Number(payment.hospital_amount);
    } else if (payment.status === 'pending' || payment.status === 'partial') {
      appointmentsPending++;
    }

    for (const tx of payment.transactions) {
      const amount = Number(tx.amount);
      if (tx.direction === 'credit') {
        totalCollected += amount;
        const m = tx.method as keyof typeof byMethod;
        if (byMethod[m]) {
          byMethod[m].count++;
          byMethod[m].amount += amount;
        }
      } else {
        totalRefunded += amount;
      }
    }
  }

  return {
    date: date,
    total_collected: totalCollected,
    total_refunded: totalRefunded,
    net_revenue: totalCollected - totalRefunded,
    doctor_revenue: doctorRevenue,
    hospital_revenue: hospitalRevenue,
    by_method: byMethod,
    appointments_billed: appointmentsBilled,
    appointments_fully_paid: appointmentsFullyPaid,
    appointments_pending: appointmentsPending,
    payments: payments.map((p) => ({
      payment_id: p.payment_id,
      patient_name: p.appointment?.patient?.name || '',
      doctor_name: p.appointment?.doctor?.name || '',
      total_amount: Number(p.total_amount),
      amount_paid: Number(p.amount_paid),
      status: p.status,
    })),
  };
}

/**
 * Monthly revenue summary — aggregated by day.
 */
export async function getMonthlyRevenue(hospitalId: string, year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1); // first day of next month

  const payments = await prisma.payment.findMany({
    where: {
      hospital_id: hospitalId,
      appointment: {
        session: {
          session_date: { gte: startDate, lt: endDate },
        },
      },
    },
    include: {
      transactions: true,
      appointment: {
        select: {
          doctor_id: true,
          doctor: { select: { name: true, specialization: true } },
          session: { select: { session_date: true } },
        },
      },
    },
  });

  let totalCollected = 0;
  let totalRefunded = 0;
  let doctorRevenue = 0;
  let hospitalRevenue = 0;

  const byDay: Record<string, { collected: number; refunded: number; appointments_billed: number }> = {};
  const byMethod: Record<string, { count: number; amount: number }> = {
    cash: { count: 0, amount: 0 },
    card: { count: 0, amount: 0 },
    online: { count: 0, amount: 0 },
    insurance: { count: 0, amount: 0 },
  };
  const doctorMap: Record<string, { name: string; specialization: string; appointments: number; earned: number }> = {};

  for (const payment of payments) {
    const sessionDate = payment.appointment?.session?.session_date;
    const dayKey = sessionDate ? sessionDate.toISOString().split('T')[0]! : 'unknown';

    if (!byDay[dayKey]) {
      byDay[dayKey] = { collected: 0, refunded: 0, appointments_billed: 0 };
    }
    byDay[dayKey].appointments_billed++;

    if (payment.status === 'paid') {
      doctorRevenue += Number(payment.doctor_amount);
      hospitalRevenue += Number(payment.hospital_amount);
    }

    // Doctor aggregation
    const doctorId = payment.appointment?.doctor_id;
    if (doctorId && payment.status === 'paid') {
      if (!doctorMap[doctorId]) {
        doctorMap[doctorId] = {
          name: payment.appointment?.doctor?.name || '',
          specialization: payment.appointment?.doctor?.specialization || '',
          appointments: 0,
          earned: 0,
        };
      }
      doctorMap[doctorId].appointments++;
      doctorMap[doctorId].earned += Number(payment.doctor_amount);
    }

    for (const tx of payment.transactions) {
      const amount = Number(tx.amount);
      if (tx.direction === 'credit') {
        totalCollected += amount;
        byDay[dayKey].collected += amount;
        const m = tx.method as keyof typeof byMethod;
        if (byMethod[m]) {
          byMethod[m].count++;
          byMethod[m].amount += amount;
        }
      } else {
        totalRefunded += amount;
        byDay[dayKey].refunded += amount;
      }
    }
  }

  // Sort by_day by date
  const sortedByDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  // Top doctors sorted by earned
  const topDoctors = Object.entries(doctorMap)
    .map(([doctor_id, d]) => ({
      doctor_id,
      name: d.name,
      specialization: d.specialization,
      appointments_completed: d.appointments,
      total_earned: d.earned,
    }))
    .sort((a, b) => b.total_earned - a.total_earned);

  return {
    year,
    month,
    total_collected: totalCollected,
    total_refunded: totalRefunded,
    net_revenue: totalCollected - totalRefunded,
    doctor_revenue: doctorRevenue,
    hospital_revenue: hospitalRevenue,
    by_day: sortedByDay,
    by_method: byMethod,
    top_doctors: topDoctors,
  };
}

/**
 * Doctor-specific revenue report.
 */
export async function getDoctorRevenue(
  hospitalId: string,
  doctorId: string,
  from: string,
  to: string,
) {
  const startDate = new Date(from);
  const endDate = new Date(to);
  endDate.setDate(endDate.getDate() + 1); // inclusive end

  const payments = await prisma.payment.findMany({
    where: {
      hospital_id: hospitalId,
      status: { in: ['paid', 'partial'] },
      appointment: {
        doctor_id: doctorId,
        session: {
          session_date: { gte: startDate, lt: endDate },
        },
      },
    },
    include: {
      appointment: {
        select: {
          appointment_id: true,
          queue_number: true,
          patient: { select: { name: true } },
          session: { select: { session_date: true } },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  let totalEarned = 0;
  const byDay: Record<string, { appointments: number; earned: number }> = {};

  const transactions = payments.map((p) => {
    const sessionDate = p.appointment?.session?.session_date;
    const dayKey = sessionDate ? sessionDate.toISOString().split('T')[0]! : 'unknown';
    const earned = Number(p.doctor_amount);
    totalEarned += earned;

    if (!byDay[dayKey]) byDay[dayKey] = { appointments: 0, earned: 0 };
    byDay[dayKey].appointments++;
    byDay[dayKey].earned += earned;

    return {
      appointment_id: p.appointment?.appointment_id || '',
      patient_name: p.appointment?.patient?.name || '',
      session_date: dayKey,
      queue_display: `Q${String(p.appointment?.queue_number || 0).padStart(3, '0')}`,
      doctor_amount: earned,
      payment_status: p.status,
      paid_at: p.updated_at,
    };
  });

  // Calculate days in range for average
  const dayCount = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    period: { from, to },
    total_appointments: payments.length,
    total_earned: totalEarned,
    average_per_day: Math.round((totalEarned / dayCount) * 100) / 100,
    by_day: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d })),
    transactions,
  };
}

/**
 * Dashboard summary — today + this month.
 * Uses separate queries for speed.
 */
export async function getSummary(hospitalId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Today's payments
  const todayPayments = await prisma.payment.findMany({
    where: {
      hospital_id: hospitalId,
      appointment: {
        session: { session_date: { gte: todayStart, lt: todayEnd } },
      },
    },
    include: { transactions: { where: { direction: 'credit' } } },
  });

  let todayCollected = 0;
  let todayBilled = 0;
  let todayPending = 0;

  for (const p of todayPayments) {
    todayBilled++;
    if (p.status === 'pending' || p.status === 'partial') todayPending++;
    for (const tx of p.transactions) {
      todayCollected += Number(tx.amount);
    }
  }

  // This month's payments
  const monthPayments = await prisma.payment.findMany({
    where: {
      hospital_id: hospitalId,
      appointment: {
        session: { session_date: { gte: monthStart, lt: monthEnd } },
      },
    },
    include: { transactions: true },
  });

  let monthCollected = 0;
  let monthRefunded = 0;
  let monthDoctorRev = 0;
  let monthHospitalRev = 0;

  for (const p of monthPayments) {
    if (p.status === 'paid') {
      monthDoctorRev += Number(p.doctor_amount);
      monthHospitalRev += Number(p.hospital_amount);
    }
    for (const tx of p.transactions) {
      if (tx.direction === 'credit') {
        monthCollected += Number(tx.amount);
      } else {
        monthRefunded += Number(tx.amount);
      }
    }
  }

  return {
    today: {
      collected: todayCollected,
      appointments_billed: todayBilled,
      appointments_pending: todayPending,
    },
    this_month: {
      collected: monthCollected,
      net_revenue: monthCollected - monthRefunded,
      doctor_revenue: monthDoctorRev,
      hospital_revenue: monthHospitalRev,
    },
  };
}

// ── Validation Queries ───────────────────────────────────────────────────────

export async function findAppointmentInHospital(appointmentId: string, hospitalId: string) {
  return prisma.appointment.findFirst({
    where: { appointment_id: appointmentId, hospital_id: hospitalId },
    select: {
      appointment_id: true,
      status: true,
      total_fee: true,
      doctor_fee: true,
      hospital_charge: true,
      queue_number: true,
    },
  });
}

export async function findDoctorInHospital(doctorId: string, hospitalId: string) {
  return prisma.doctor.findFirst({
    where: { doctor_id: doctorId, hospital_id: hospitalId },
    select: { doctor_id: true, name: true, specialization: true },
  });
}

// ── Audit Log ────────────────────────────────────────────────────────────────

export async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
) {
  return prisma.auditLog.create({
    data: {
      user_id: userId,
      action,
      entity,
      entity_id: entityId ?? null,
    },
  });
}
