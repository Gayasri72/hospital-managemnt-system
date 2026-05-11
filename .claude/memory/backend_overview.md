---
name: MediCore HMS Backend Overview
description: Architecture, stack, modules, DB schema, and known issues of the hospital management system backend
type: project
---

Node.js/Express 5 + TypeScript backend for MediCore HMS. Deployed on Vercel as a serverless function via api/index.ts. PostgreSQL via Prisma ORM (Supabase).

**Stack:** Express 5, TypeScript, Prisma 6, PostgreSQL, Zod validation, Winston logging, Helmet, express-rate-limit, bcryptjs, jsonwebtoken, vitest.

**Architecture:** 4-layer — Routes → Controller → Service → Repository → Prisma. Domain modules: auth, patients, doctors, sessions, appointments, payments, reports, admin, dashboard, medical, branches, health.

**DB Models:** Hospital → Branch (multi-tenant); User → Role → RolePermission → Permission; Doctor → DoctorProfile, DoctorFee, DoctorAvailability, DoctorException; Patient → PatientProfile; ChannelSession → SessionSlot; Appointment → AppointmentLog, Payment → PaymentTransaction; MedicalRecord → Prescription; RefreshToken, AuditLog.

**Auth:** JWT access (15min) + refresh (7d). Refresh tokens stored hashed in DB (bcrypt). Token rotation on refresh. httpOnly cookie for refresh token is READY on backend — disabled on frontend (withCredentials: false) due to CORS wildcard issue.

**CORS:** backend allows *.vercel.app + CORS_ORIGIN env var, credentials: true. Frontend needs withCredentials: true to use httpOnly cookies.

**Known frontend/backend mismatches:**
- Frontend sends PATCH /sessions/:id with full payload; backend expects PUT /sessions/:id (full update) or PATCH /sessions/:id/status (status only)
- Frontend sends status as "Completed" (capitalized); backend ALLOWED_TRANSITIONS uses lowercase ("completed")
- "Manager" and "Nurse" roles exist in frontend types but NOT in backend ROLES constant or seed — they will fail role checks
- Session creation: backend restricts to Hospital Admin/Super Admin; frontend shows "New Session" to all non-Accountant roles
- Fee NOT_CONFIGURED error: backend requires DoctorFee + HospitalCharge rows before any appointment can be created — frontend never surfaces this error properly

**How to apply:** When diagnosing 400/403/409 errors, check the status transition map, role constants, and fee configuration requirements first.
