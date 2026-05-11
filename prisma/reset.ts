// ──────────────────────────────────────────────────────────────────────────────
// Database Reset — wipes all transactional/operational data while keeping:
//   • Roles, Permissions, RolePermissions (system config)
//   • The seeded Hospital and Branch
//   • The Super Admin user (admin@hospital.com)
//
// Run from the project root:
//   npx ts-node prisma/reset.ts
// ──────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'admin@hospital.com';

async function main() {
  console.log('⚠️  Starting database reset...\n');

  // Find super admin so we can preserve them
  const superAdmin = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
  if (!superAdmin) {
    console.error(`❌ Super Admin (${SUPER_ADMIN_EMAIL}) not found — aborting to avoid lockout.`);
    process.exit(1);
  }
  console.log(`✔  Super Admin found: ${superAdmin.name} (${superAdmin.email})`);

  // ── Step 1: Prescriptions (child of medical_records + patients) ──────────
  const { count: rx } = await prisma.prescription.deleteMany({});
  console.log(`✔  Deleted ${rx} prescriptions`);

  // ── Step 2: Medical Records ───────────────────────────────────────────────
  const { count: mr } = await prisma.medicalRecord.deleteMany({});
  console.log(`✔  Deleted ${mr} medical records`);

  // ── Step 3: Payment Transactions ─────────────────────────────────────────
  const { count: pt } = await prisma.paymentTransaction.deleteMany({});
  console.log(`✔  Deleted ${pt} payment transactions`);

  // ── Step 4: Payments ──────────────────────────────────────────────────────
  const { count: pay } = await prisma.payment.deleteMany({});
  console.log(`✔  Deleted ${pay} payments`);

  // ── Step 5: Appointment Logs ──────────────────────────────────────────────
  const { count: al } = await prisma.appointmentLog.deleteMany({});
  console.log(`✔  Deleted ${al} appointment logs`);

  // ── Step 6: Appointments ──────────────────────────────────────────────────
  const { count: appt } = await prisma.appointment.deleteMany({});
  console.log(`✔  Deleted ${appt} appointments`);

  // ── Step 7: Session Slots ─────────────────────────────────────────────────
  const { count: slots } = await prisma.sessionSlot.deleteMany({});
  console.log(`✔  Deleted ${slots} session slots`);

  // ── Step 8: Channel Sessions ──────────────────────────────────────────────
  const { count: sessions } = await prisma.channelSession.deleteMany({});
  console.log(`✔  Deleted ${sessions} channel sessions`);

  // ── Step 9: Doctor sub-records ────────────────────────────────────────────
  const { count: de } = await prisma.doctorException.deleteMany({});
  const { count: da } = await prisma.doctorAvailability.deleteMany({});
  const { count: df } = await prisma.doctorFee.deleteMany({});
  const { count: dp } = await prisma.doctorProfile.deleteMany({});
  console.log(`✔  Deleted ${de} doctor exceptions, ${da} availabilities, ${df} fees, ${dp} profiles`);

  // ── Step 10: Doctors (skip any linked to super admin just in case) ────────
  const { count: docs } = await prisma.doctor.deleteMany({
    where: { user_id: { not: superAdmin.user_id } },
  });
  // Also delete unlinked doctors (user_id is null)
  const { count: unlinkedDocs } = await prisma.doctor.deleteMany({
    where: { user_id: null },
  });
  console.log(`✔  Deleted ${docs + unlinkedDocs} doctors`);

  // ── Step 11: Patient Profiles + Patients ──────────────────────────────────
  const { count: pp } = await prisma.patientProfile.deleteMany({});
  const { count: patients } = await prisma.patient.deleteMany({});
  console.log(`✔  Deleted ${patients} patients (${pp} profiles)`);

  // ── Step 12: Hospital Charges ─────────────────────────────────────────────
  const { count: hc } = await prisma.hospitalCharge.deleteMany({});
  console.log(`✔  Deleted ${hc} hospital charges`);

  // ── Step 13: Audit Logs ───────────────────────────────────────────────────
  const { count: audit } = await prisma.auditLog.deleteMany({});
  console.log(`✔  Deleted ${audit} audit log entries`);

  // ── Step 14: Refresh Tokens ───────────────────────────────────────────────
  const { count: tokens } = await prisma.refreshToken.deleteMany({});
  console.log(`✔  Deleted ${tokens} refresh tokens`);

  // ── Step 15: Users (everyone except super admin) ──────────────────────────
  const { count: users } = await prisma.user.deleteMany({
    where: { email: { not: SUPER_ADMIN_EMAIL } },
  });
  console.log(`✔  Deleted ${users} users (Super Admin preserved)`);

  console.log('\n✅ Reset complete. The following are preserved:');
  console.log('   • Roles & Permissions');
  console.log('   • Hospital & Branch');
  console.log(`   • Super Admin: ${SUPER_ADMIN_EMAIL} / Admin@123`);
}

main()
  .catch((err) => {
    console.error('\n❌ Reset failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
