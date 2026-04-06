-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "hospitals" (
    "hospital_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "contact_number" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("hospital_id")
);

-- CreateTable
CREATE TABLE "branches" (
    "branch_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("branch_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "permission_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "role_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "entity" VARCHAR(255) NOT NULL,
    "entity_id" VARCHAR(255),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "token_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("token_id")
);

-- CreateTable
CREATE TABLE "patients" (
    "patient_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nic" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("patient_id")
);

-- CreateTable
CREATE TABLE "patient_profiles" (
    "patient_id" UUID NOT NULL,
    "address" TEXT,
    "emergency_contact" VARCHAR(20),
    "gender" VARCHAR(10),
    "age" INTEGER,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("patient_id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "appointment_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "session_id" UUID,
    "slot_id" UUID,
    "queue_number" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'booked',
    "doctor_fee" DECIMAL(10,2) NOT NULL,
    "hospital_charge" DECIMAL(10,2) NOT NULL,
    "total_fee" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "booked_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateTable
CREATE TABLE "appointment_logs" (
    "log_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "old_status" VARCHAR(30),
    "new_status" VARCHAR(30) NOT NULL,
    "changed_by" UUID NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "doctor_amount" DECIMAL(10,2) NOT NULL,
    "hospital_amount" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "transaction_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "direction" VARCHAR(10) NOT NULL DEFAULT 'credit',
    "reference" VARCHAR(100),
    "note" TEXT,
    "processed_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "doctor_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "specialization" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("doctor_id")
);

-- CreateTable
CREATE TABLE "doctor_profiles" (
    "doctor_id" UUID NOT NULL,
    "contact_number" VARCHAR(20),
    "email" VARCHAR(255),
    "qualifications" TEXT,
    "experience" VARCHAR(100),
    "bio" TEXT,

    CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("doctor_id")
);

-- CreateTable
CREATE TABLE "doctor_fees" (
    "fee_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "consultation_fee" DECIMAL(10,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_fees_pkey" PRIMARY KEY ("fee_id")
);

-- CreateTable
CREATE TABLE "hospital_charges" (
    "charge_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "charge_amount" DECIMAL(10,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_charges_pkey" PRIMARY KEY ("charge_id")
);

-- CreateTable
CREATE TABLE "doctor_availability" (
    "availability_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "day_of_week" VARCHAR(10) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_availability_pkey" PRIMARY KEY ("availability_id")
);

-- CreateTable
CREATE TABLE "doctor_exceptions" (
    "exception_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "exception_date" DATE NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_exceptions_pkey" PRIMARY KEY ("exception_id")
);

-- CreateTable
CREATE TABLE "channel_sessions" (
    "session_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "session_date" DATE NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "slot_duration" INTEGER NOT NULL DEFAULT 10,
    "max_patients" INTEGER NOT NULL,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "session_slots" (
    "slot_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "slot_time" VARCHAR(5) NOT NULL,
    "is_booked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_slots_pkey" PRIMARY KEY ("slot_id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "record_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "notes" TEXT,
    "follow_up_date" DATE,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("record_id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "prescription_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "hospital_id" UUID NOT NULL,
    "medicine_name" VARCHAR(255) NOT NULL,
    "dosage" VARCHAR(100) NOT NULL,
    "frequency" VARCHAR(100) NOT NULL,
    "duration" VARCHAR(100) NOT NULL,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("prescription_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_hospital_id_nic_key" ON "patients"("hospital_id", "nic");

-- CreateIndex
CREATE UNIQUE INDEX "payments_appointment_id_key" ON "payments"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_user_id_key" ON "doctors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_appointment_id_key" ON "medical_records"("appointment_id");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("patient_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("patient_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "channel_sessions"("session_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "session_slots"("slot_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_logs" ADD CONSTRAINT "appointment_logs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("appointment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("appointment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_fees" ADD CONSTRAINT "doctor_fees_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_fees" ADD CONSTRAINT "doctor_fees_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_charges" ADD CONSTRAINT "hospital_charges_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_exceptions" ADD CONSTRAINT "doctor_exceptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_slots" ADD CONSTRAINT "session_slots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "channel_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("appointment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("patient_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "medical_records"("record_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("patient_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("hospital_id") ON DELETE CASCADE ON UPDATE CASCADE;

