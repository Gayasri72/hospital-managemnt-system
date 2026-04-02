# Hospital Management System — Complete Postman Testing Guide

> **Base URL**: `http://localhost:5000/api/v1`
> **Test order**: Follow the modules in sequence — each builds on data from the previous.

---

## Pre-requisites

1. Start PostgreSQL
2. Run `npx prisma migrate dev` (creates tables)
3. Run `npx prisma db seed` (creates roles, permissions, test hospital, Super Admin user)
4. Start server: `npm run dev`

---

## MODULE 1 — Health Check

### 1.1 GET /health

| | |
|---|---|
| **Method** | GET |
| **URL** | `{{baseUrl}}/health` |
| **Auth** | None |
| **Purpose** | Verify server is running |

**Expected**: `200 OK`
```json
{ "success": true, "message": "Server is running" }
```

---

## MODULE 2 — Authentication

### 2.1 POST /auth/login — ✅ Success

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/auth/login` |
| **Auth** | None |
| **Headers** | `Content-Type: application/json` |

**Body**:
```json
{
  "email": "admin@hospital.com",
  "password": "Admin@123"
}
```

**Expected**: `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "user_id": "...",
      "name": "System Administrator",
      "email": "admin@hospital.com",
      "role": "Super Admin",
      "hospital_id": "00000000-0000-0000-0000-000000000001"
    }
  }
}
```

**⚠️ IMPORTANT**: Copy `accessToken` from the response. Set it as a Postman variable:
- Go to **Environment** → create variable `token` → paste the accessToken value
- For all subsequent requests, set **Authorization** tab → **Bearer Token** → `{{token}}`

---

### 2.2 POST /auth/login — ❌ Wrong password

**Body**:
```json
{
  "email": "admin@hospital.com",
  "password": "WrongPassword"
}
```

**Expected**: `401`
```json
{ "success": false, "message": "Invalid email or password." }
```

---

### 2.3 POST /auth/login — ❌ Non-existent email

**Body**:
```json
{
  "email": "nobody@hospital.com",
  "password": "Admin@123"
}
```

**Expected**: `401`
```json
{ "success": false, "message": "Invalid email or password." }
```

---

### 2.4 POST /auth/login — ❌ Missing fields

**Body**:
```json
{
  "email": ""
}
```

**Expected**: `422 Validation failed`

---

### 2.5 GET /auth/me — ✅ Get current user

| | |
|---|---|
| **Method** | GET |
| **URL** | `{{baseUrl}}/auth/me` |
| **Auth** | Bearer `{{token}}` |

**Expected**: `200 OK` — returns user details with role and hospital

---

### 2.6 GET /auth/me — ❌ No token

| | |
|---|---|
| **Method** | GET |
| **URL** | `{{baseUrl}}/auth/me` |
| **Auth** | None |

**Expected**: `401`
```json
{ "success": false, "message": "Authentication required. Please provide a valid token." }
```

---

### 2.7 POST /auth/refresh — ✅ Refresh token

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/auth/refresh` |
| **Auth** | None |

**Note**: This uses the httpOnly cookie set during login. In Postman, cookies are auto-managed. Just send the request — the cookie from login will be included.

**Expected**: `200 OK` — returns new `accessToken`

---

### 2.8 POST /auth/logout — ✅ Logout

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/auth/logout` |
| **Auth** | Bearer `{{token}}` |

**Expected**: `200 OK`
```json
{ "success": true, "message": "Logged out successfully" }
```

**After this**: Login again to get a fresh token for remaining tests.

---

## MODULE 3 — Admin (Permissions, Roles, Users)

> **Login as**: Super Admin (`admin@hospital.com` / `Admin@123`)

### 3.1 GET /admin/permissions — ✅ List all permissions

| | |
|---|---|
| **Method** | GET |
| **URL** | `{{baseUrl}}/admin/permissions` |
| **Auth** | Bearer `{{token}}` |

**Expected**: `200 OK` — array of 19 permissions
```json
{
  "success": true,
  "data": [
    { "permission_id": 1, "name": "view_patients" },
    { "permission_id": 2, "name": "create_patients" },
    ...
  ]
}
```

**Save the permission IDs** — you'll need them to create custom roles.

---

### 3.2 GET /admin/roles — ✅ List all roles

| | |
|---|---|
| **Method** | GET |
| **URL** | `{{baseUrl}}/admin/roles` |
| **Auth** | Bearer `{{token}}` |

**Expected**: `200 OK` — 5 default roles with permissions and user count

---

### 3.3 POST /admin/roles — ✅ Create custom role

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/admin/roles` |
| **Auth** | Bearer `{{token}}` |

**Body** (create a "Lab Technician" role with limited permissions):
```json
{
  "name": "Lab Technician",
  "permission_ids": [1, 4]
}
```
*(Use actual permission_ids from step 3.1 — e.g., view_patients and view_doctors)*

**Expected**: `201 Created`
```json
{
  "success": true,
  "data": {
    "role_id": 6,
    "name": "Lab Technician",
    "is_system_role": false,
    "user_count": 0,
    "permissions": [
      { "permission_id": 1, "name": "view_patients" },
      { "permission_id": 4, "name": "view_doctors" }
    ]
  }
}
```

**Save `role_id`** — needed for user creation and updates.

---

### 3.4 POST /admin/roles — ❌ Duplicate name

**Body**:
```json
{
  "name": "Lab Technician",
  "permission_ids": [1]
}
```

**Expected**: `409`
```json
{ "success": false, "message": "Role 'Lab Technician' already exists.", "code": "ROLE_NAME_EXISTS" }
```

---

### 3.5 POST /admin/roles — ❌ Invalid permission IDs

**Body**:
```json
{
  "name": "Test Role",
  "permission_ids": [999, 1000]
}
```

**Expected**: `400`
```json
{ "success": false, "message": "Invalid permission IDs: 999, 1000", "code": "INVALID_PERMISSION_IDS" }
```

---

### 3.6 POST /admin/roles — ❌ Empty permissions

**Body**:
```json
{
  "name": "Empty Role",
  "permission_ids": []
}
```

**Expected**: `422 Validation failed` — "At least one permission is required"

---

### 3.7 GET /admin/roles/:id — ✅ Get role details

| | |
|---|---|
| **Method** | GET |
| **URL** | `{{baseUrl}}/admin/roles/6` |
| **Auth** | Bearer `{{token}}` |

*(Use the role_id from step 3.3)*

**Expected**: `200 OK` — full role with permissions

---

### 3.8 PUT /admin/roles/:id — ✅ Update custom role permissions

| | |
|---|---|
| **Method** | PUT |
| **URL** | `{{baseUrl}}/admin/roles/6` |
| **Auth** | Bearer `{{token}}` |

**Body** (add more permissions):
```json
{
  "permission_ids": [1, 2, 4, 11]
}
```

**Expected**: `200 OK` — updated role with new permissions

---

### 3.9 PUT /admin/roles/:id — ✅ Rename custom role

**Body**:
```json
{
  "name": "Senior Lab Technician"
}
```

**Expected**: `200 OK`

---

### 3.10 PUT /admin/roles/:id — ❌ Try to rename system role

| | |
|---|---|
| **URL** | `{{baseUrl}}/admin/roles/1` |

**Body**:
```json
{
  "name": "Super Duper Admin"
}
```

**Expected**: `403`
```json
{ "success": false, "message": "Cannot rename the system role 'Super Admin'.", "code": "CANNOT_MODIFY_SYSTEM_ROLE" }
```

---

### 3.11 POST /admin/users — ✅ Create a Receptionist user

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/admin/users` |
| **Auth** | Bearer `{{token}}` |

**Body**:
```json
{
  "name": "Saman Kumara",
  "email": "saman@hospital.com",
  "password": "Saman@123",
  "role_id": 3
}
```
*(role_id 3 = Receptionist from the seed)*

**Expected**: `201 Created`
```json
{
  "success": true,
  "data": {
    "user_id": "...",
    "name": "Saman Kumara",
    "email": "saman@hospital.com",
    "status": "ACTIVE",
    "role": { "role_id": 3, "name": "Receptionist" }
  }
}
```

---

### 3.12 POST /admin/users — ✅ Create a Doctor user

**Body**:
```json
{
  "name": "Dr. Nimal Fernando",
  "email": "nimal@hospital.com",
  "password": "Nimal@123",
  "role_id": 4
}
```

**Expected**: `201 Created`

---

### 3.13 POST /admin/users — ✅ Create an Accountant user

**Body**:
```json
{
  "name": "Priya Jayawardena",
  "email": "priya@hospital.com",
  "password": "Priya@123",
  "role_id": 5
}
```

**Expected**: `201 Created`

---

### 3.14 POST /admin/users — ❌ Duplicate email

**Body**:
```json
{
  "name": "Another Person",
  "email": "saman@hospital.com",
  "password": "Test@1234",
  "role_id": 3
}
```

**Expected**: `409`
```json
{ "success": false, "message": "A user with this email already exists.", "code": "EMAIL_ALREADY_EXISTS" }
```

---

### 3.15 POST /admin/users — ❌ Weak password

**Body**:
```json
{
  "name": "Weak User",
  "email": "weak@hospital.com",
  "password": "123",
  "role_id": 3
}
```

**Expected**: `422 Validation failed`

---

### 3.16 POST /admin/users — ❌ Invalid role_id

**Body**:
```json
{
  "name": "Bad Role",
  "email": "badrole@hospital.com",
  "password": "Valid@123",
  "role_id": 999
}
```

**Expected**: `404`
```json
{ "success": false, "message": "Role not found.", "code": "ROLE_NOT_FOUND" }
```

---

### 3.17 GET /admin/users — ✅ List all users

| | |
|---|---|
| **Method** | GET |
| **URL** | `{{baseUrl}}/admin/users` |
| **Auth** | Bearer `{{token}}` |

**Expected**: `200 OK` — paginated list of users

---

### 3.18 GET /admin/users?search=saman — ✅ Search users

| | |
|---|---|
| **URL** | `{{baseUrl}}/admin/users?search=saman` |

**Expected**: Returns users matching "saman"

---

### 3.19 GET /admin/users?role_id=3 — ✅ Filter by role

| | |
|---|---|
| **URL** | `{{baseUrl}}/admin/users?role_id=3` |

**Expected**: Returns only Receptionists

---

### 3.20 GET /admin/users/:id — ✅ Get user details

| | |
|---|---|
| **URL** | `{{baseUrl}}/admin/users/{user_id}` |

*(Use the user_id from step 3.11)*

**Expected**: `200 OK` — user with role + permissions

---

### 3.21 PUT /admin/users/:id — ✅ Change user's role

| | |
|---|---|
| **Method** | PUT |
| **URL** | `{{baseUrl}}/admin/users/{user_id}` |
| **Auth** | Bearer `{{token}}` |

**Body**:
```json
{
  "role_id": 6
}
```
*(Assign the custom "Lab Technician" role)*

**Expected**: `200 OK` — user with updated role

---

### 3.22 PATCH /admin/users/:id/status — ✅ Deactivate user

| | |
|---|---|
| **Method** | PATCH |
| **URL** | `{{baseUrl}}/admin/users/{user_id}/status` |
| **Auth** | Bearer `{{token}}` |

**Body**:
```json
{
  "status": "INACTIVE"
}
```

**Expected**: `200 OK`

---

### 3.23 PATCH /admin/users/:id/status — ❌ Try to deactivate yourself

| | |
|---|---|
| **URL** | `{{baseUrl}}/admin/users/{YOUR_OWN_user_id}/status` |

**Body**:
```json
{
  "status": "INACTIVE"
}
```

**Expected**: `403`
```json
{ "success": false, "message": "You cannot deactivate your own account.", "code": "CANNOT_DEACTIVATE_SELF" }
```

---

### 3.24 PATCH /admin/users/:id/password — ✅ Reset password

| | |
|---|---|
| **Method** | PATCH |
| **URL** | `{{baseUrl}}/admin/users/{user_id}/password` |
| **Auth** | Bearer `{{token}}` |

**Body**:
```json
{
  "new_password": "NewPass@123"
}
```

**Expected**: `200 OK`

---

### 3.25 DELETE /admin/roles/:id — ❌ Delete role with users assigned

| | |
|---|---|
| **Method** | DELETE |
| **URL** | `{{baseUrl}}/admin/roles/6` |
| **Auth** | Bearer `{{token}}` |

**Expected**: `409`
```json
{ "success": false, "message": "Cannot delete role 'Senior Lab Technician' — 1 user(s) are still assigned to it.", "code": "ROLE_HAS_USERS" }
```

---

### 3.26 DELETE /admin/roles/:id — ❌ Delete system role

| | |
|---|---|
| **URL** | `{{baseUrl}}/admin/roles/1` |

**Expected**: `403`
```json
{ "success": false, "message": "Cannot delete the system role 'Super Admin'.", "code": "CANNOT_DELETE_SYSTEM_ROLE" }
```

---

### 3.27 Test role-based access — ❌ Login as Receptionist, try admin endpoint

Login as Receptionist first:
```json
{ "email": "saman@hospital.com", "password": "Saman@123" }
```

Then try: `GET /admin/roles` with the Receptionist's token

**Expected**: `403`
```json
{ "success": false, "message": "You do not have permission to perform this action." }
```

**After testing**: Login as Super Admin again for remaining tests.

---

## MODULE 4 — Patients

> **Login as**: Super Admin or Receptionist

### 4.1 POST /patients — ✅ Create patient

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/patients` |
| **Auth** | Bearer `{{token}}` |

**Body**:
```json
{
  "name": "Kamal Perera",
  "nic": "901234567V",
  "phone": "0771234567",
  "email": "kamal@email.com",
  "address": "123 Main St, Colombo 07",
  "emergency_contact": "0779876543",
  "gender": "Male",
  "age": 35
}
```

**Expected**: `201 Created` — patient with profile
**Save `patient_id`** for later tests.

---

### 4.2 POST /patients — ✅ Create second patient (minimal fields)

**Body**:
```json
{
  "name": "Nimali Silva",
  "nic": "951234568V",
  "phone": "0712345678"
}
```

**Expected**: `201 Created` — no profile fields (all optional)

---

### 4.3 POST /patients — ❌ Duplicate NIC

**Body**:
```json
{
  "name": "Another Person",
  "nic": "901234567V",
  "phone": "0761234567"
}
```

**Expected**: `409`
```json
{ "success": false, "code": "PATIENT_NIC_EXISTS" }
```

---

### 4.4 POST /patients — ❌ Missing required fields

**Body**:
```json
{
  "name": "No NIC"
}
```

**Expected**: `422 Validation failed`

---

### 4.5 POST /patients — ❌ Invalid gender

**Body**:
```json
{
  "name": "Bad Gender",
  "nic": "123456789V",
  "phone": "0771111111",
  "gender": "Unknown"
}
```

**Expected**: `422` — "Gender must be Male, Female, or Other"

---

### 4.6 GET /patients — ✅ List all patients

| | |
|---|---|
| **Method** | GET |
| **URL** | `{{baseUrl}}/patients` |

**Expected**: `200 OK` — paginated list with meta

---

### 4.7 GET /patients?search=kamal — ✅ Search by name

**Expected**: Returns patients matching "kamal"

---

### 4.8 GET /patients?search=901234567V — ✅ Search by NIC

**Expected**: Returns Kamal Perera

---

### 4.9 GET /patients?search=077 — ✅ Search by phone

**Expected**: Returns patients with phone containing "077"

---

### 4.10 GET /patients/:id — ✅ Get patient with profile

| | |
|---|---|
| **URL** | `{{baseUrl}}/patients/{patient_id}` |

**Expected**: `200 OK` — patient + profile joined

---

### 4.11 GET /patients/:id — ❌ Non-existent ID

| | |
|---|---|
| **URL** | `{{baseUrl}}/patients/00000000-0000-0000-0000-000000000099` |

**Expected**: `404`

---

### 4.12 PUT /patients/:id — ✅ Update patient

| | |
|---|---|
| **Method** | PUT |
| **URL** | `{{baseUrl}}/patients/{patient_id}` |

**Body**:
```json
{
  "name": "Kamal P. Perera",
  "phone": "0771234999",
  "age": 36
}
```

**Expected**: `200 OK` — updated data

---

### 4.13 GET /patients/:id/appointments — ✅ Appointment history

| | |
|---|---|
| **URL** | `{{baseUrl}}/patients/{patient_id}/appointments` |

**Expected**: `200 OK` — empty array (no appointments yet)

---

## MODULE 5 — Doctors

> **Login as**: Super Admin or Hospital Admin

### 5.1 POST /doctors — ✅ Create doctor

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/doctors` |
| **Auth** | Bearer `{{token}}` |

**Body**:
```json
{
  "name": "Dr. Nimal Silva",
  "specialization": "Cardiologist",
  "contact_number": "0112345678",
  "email": "dr.nimal@hospital.com",
  "qualifications": "MBBS, MD (Cardiology)",
  "experience": "12 years",
  "bio": "Senior cardiologist with expertise in interventional procedures",
  "consultation_fee": 2000.00,
  "effective_from": "2026-01-01"
}
```

**Expected**: `201 Created` — doctor + profile + fee entry
**Save `doctor_id`**.

---

### 5.2 POST /doctors — ✅ Create second doctor

**Body**:
```json
{
  "name": "Dr. Sunil Jayawardena",
  "specialization": "General Practitioner",
  "consultation_fee": 1500.00
}
```

**Expected**: `201 Created`

---

### 5.3 POST /doctors — ❌ Missing specialization

**Body**:
```json
{
  "name": "Dr. Bad",
  "consultation_fee": 1000.00
}
```

**Expected**: `422`

---

### 5.4 GET /doctors — ✅ List doctors

| | |
|---|---|
| **URL** | `{{baseUrl}}/doctors` |

**Expected**: `200 OK`

---

### 5.5 GET /doctors?specialization=Cardiologist — ✅ Filter

---

### 5.6 GET /doctors/:id — ✅ Get doctor details

| | |
|---|---|
| **URL** | `{{baseUrl}}/doctors/{doctor_id}` |

**Expected**: `200 OK` — doctor + profile + current fee + hospital charge

---

### 5.7 POST /doctors/:id/fees — ✅ Add new fee

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/doctors/{doctor_id}/fees` |

**Body**:
```json
{
  "consultation_fee": 2500.00,
  "effective_from": "2026-04-01"
}
```

**Expected**: `201 Created`

---

### 5.8 GET /doctors/:id/fees — ✅ View fee history

| | |
|---|---|
| **URL** | `{{baseUrl}}/doctors/{doctor_id}/fees` |

**Expected**: `200 OK` — array with both fee entries (newest first)

---

### 5.9 POST /hospital/charges — ✅ Set hospital charge

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/hospital/charges` |

**Body**:
```json
{
  "charge_amount": 500.00,
  "effective_from": "2026-01-01"
}
```

**Expected**: `201 Created`

---

### 5.10 GET /hospital/charges/current — ✅ Get current charge

| | |
|---|---|
| **URL** | `{{baseUrl}}/hospital/charges/current` |

**Expected**: `200 OK` — Rs. 500.00

---

### 5.11 POST /doctors/:id/availability — ✅ Set weekly schedule

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/doctors/{doctor_id}/availability` |

**Body**:
```json
{
  "schedule": [
    { "day_of_week": "Monday", "start_time": "18:00", "end_time": "21:00" },
    { "day_of_week": "Wednesday", "start_time": "18:00", "end_time": "21:00" },
    { "day_of_week": "Saturday", "start_time": "09:00", "end_time": "13:00" }
  ]
}
```

**Expected**: `200 OK`

---

### 5.12 POST /doctors/:id/availability — ❌ Duplicate days

**Body**:
```json
{
  "schedule": [
    { "day_of_week": "Monday", "start_time": "09:00", "end_time": "12:00" },
    { "day_of_week": "Monday", "start_time": "14:00", "end_time": "17:00" }
  ]
}
```

**Expected**: `422` — "Duplicate days are not allowed"

---

### 5.13 POST /doctors/:id/availability — ❌ end_time before start_time

**Body**:
```json
{
  "schedule": [
    { "day_of_week": "Tuesday", "start_time": "21:00", "end_time": "18:00" }
  ]
}
```

**Expected**: `422` — "end_time must be after start_time"

---

### 5.14 GET /doctors/:id/availability — ✅ Get schedule

| | |
|---|---|
| **URL** | `{{baseUrl}}/doctors/{doctor_id}/availability` |

**Expected**: `200 OK` — 3 schedule items

---

### 5.15 POST /doctors/:id/exceptions — ✅ Add exception

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/doctors/{doctor_id}/exceptions` |

**Body** (use a future date):
```json
{
  "exception_date": "2026-12-25",
  "reason": "Christmas holiday"
}
```

**Expected**: `201 Created`
**Save `exception_id`**.

---

### 5.16 POST /doctors/:id/exceptions — ❌ Past date

**Body**:
```json
{
  "exception_date": "2020-01-01",
  "reason": "Past date"
}
```

**Expected**: `422` — "Exception date must be in the future"

---

### 5.17 GET /doctors/:id/exceptions — ✅ List exceptions

| | |
|---|---|
| **URL** | `{{baseUrl}}/doctors/{doctor_id}/exceptions` |

---

### 5.18 DELETE /doctors/:id/exceptions/:exception_id — ✅ Remove exception

| | |
|---|---|
| **Method** | DELETE |
| **URL** | `{{baseUrl}}/doctors/{doctor_id}/exceptions/{exception_id}` |

**Expected**: `200 OK`

---

### 5.19 PUT /doctors/:id — ✅ Update doctor

| | |
|---|---|
| **Method** | PUT |
| **URL** | `{{baseUrl}}/doctors/{doctor_id}` |

**Body**:
```json
{
  "name": "Dr. Nimal D. Silva",
  "specialization": "Interventional Cardiologist"
}
```

**Expected**: `200 OK`

---

### 5.20 PUT /doctors/:id — ❌ Deactivate doctor (will test after sessions)

*(Skip for now — test after creating sessions)*

---

## MODULE 6 — Sessions

> **Login as**: Super Admin or Hospital Admin
> **Prerequisite**: You need a `branch_id`. Check your seeds or create one.

### 6.0 Get branch_id

Check the hospital branches. If none exist, you may need to query directly. The seed creates a hospital but might not create a branch. If needed, create one via database or I can add an endpoint.

**Alternative**: Check if branch exists:
```sql
SELECT branch_id, name FROM branches;
```

If no branch, insert one:
```sql
INSERT INTO branches (branch_id, hospital_id, name, location)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Colombo Branch', 'Colombo 03');
```

**Save `branch_id`**.

---

### 6.1 POST /sessions — ✅ Create session

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/sessions` |
| **Auth** | Bearer `{{token}}` |

**Body** (use a future date):
```json
{
  "doctor_id": "{doctor_id}",
  "branch_id": "{branch_id}",
  "session_date": "2026-05-05",
  "start_time": "18:00",
  "end_time": "21:00",
  "slot_duration": 10
}
```

**Expected**: `201 Created` — session with auto-generated slots (18 slots for 3 hours × 10 min)
**Save `session_id`**.

---

### 6.2 POST /sessions — ❌ Overlapping session

**Body** (same doctor, same date, overlapping time):
```json
{
  "doctor_id": "{doctor_id}",
  "branch_id": "{branch_id}",
  "session_date": "2026-05-05",
  "start_time": "19:00",
  "end_time": "22:00"
}
```

**Expected**: `409 SESSION_OVERLAP`

---

### 6.3 POST /sessions — ❌ Past date

**Body**:
```json
{
  "doctor_id": "{doctor_id}",
  "branch_id": "{branch_id}",
  "session_date": "2020-01-01",
  "start_time": "09:00",
  "end_time": "12:00"
}
```

**Expected**: `400` or `422`

---

### 6.4 GET /sessions — ✅ List sessions

| | |
|---|---|
| **URL** | `{{baseUrl}}/sessions` |

**Expected**: `200 OK`

---

### 6.5 GET /sessions/:id — ✅ Get session with slots

| | |
|---|---|
| **URL** | `{{baseUrl}}/sessions/{session_id}` |

**Expected**: `200 OK` — session + all slots (all `is_booked: false`)

---

### 6.6 GET /sessions/:id/slots — ✅ List slots

| | |
|---|---|
| **URL** | `{{baseUrl}}/sessions/{session_id}/slots` |

**Expected**: `200 OK` — array of 18 slots

---

### 6.7 PATCH /sessions/:id/status — ✅ Open the session

| | |
|---|---|
| **Method** | PATCH |
| **URL** | `{{baseUrl}}/sessions/{session_id}/status` |

**Body**:
```json
{ "status": "open" }
```

**Expected**: `200 OK` — status changed to "open"

---

### 6.8 PATCH /sessions/:id/status — ❌ Invalid transition

**Body**:
```json
{ "status": "scheduled" }
```

**Expected**: `409 INVALID_STATUS_TRANSITION`

---

### 6.9 GET /sessions/available — ✅ Find bookable sessions

| | |
|---|---|
| **URL** | `{{baseUrl}}/sessions/available` |

**Expected**: `200 OK` — only open sessions with available slots

---

### 6.10 POST /sessions — ✅ Create second session (for rescheduling later)

Create another session for the same doctor on a different date:
```json
{
  "doctor_id": "{doctor_id}",
  "branch_id": "{branch_id}",
  "session_date": "2026-05-12",
  "start_time": "18:00",
  "end_time": "21:00",
  "slot_duration": 10
}
```

Open it:
```json
{ "status": "open" }
```

**Save `second_session_id`**.

---

## MODULE 7 — Appointments

> **Login as**: Receptionist or Super Admin
> **Prerequisites**: An open session with available slots + a registered patient

### 7.1 POST /appointments — ✅ Book appointment

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/appointments` |
| **Auth** | Bearer `{{token}}` |

**Body**:
```json
{
  "patient_id": "{patient_id}",
  "session_id": "{session_id}"
}
```
*(No slot_id — system picks next available)*

**Expected**: `201 Created`
```json
{
  "data": {
    "appointment_id": "...",
    "queue_number": 1,
    "slot_time": "18:00",
    "status": "booked",
    "doctor_fee": 2000.00,
    "hospital_charge": 500.00,
    "total_fee": 2500.00
  }
}
```

**Save `appointment_id`**.

**Verify**: Fee values are snapshots, not live lookups.

---

### 7.2 POST /appointments — ✅ Book with specific slot

First get available slots: `GET /sessions/{session_id}/slots`
Pick an unbooked slot_id.

**Body**:
```json
{
  "patient_id": "{second_patient_id}",
  "session_id": "{session_id}",
  "slot_id": "{specific_slot_id}",
  "notes": "Follow-up visit for chest pain"
}
```

**Expected**: `201 Created` with the chosen slot

---

### 7.3 POST /appointments — ❌ Duplicate booking (same patient, same session)

**Body**:
```json
{
  "patient_id": "{patient_id}",
  "session_id": "{session_id}"
}
```

**Expected**: `409 DUPLICATE_APPOINTMENT`

---

### 7.4 POST /appointments — ❌ Slot already taken

**Body** (use a slot that was already booked):
```json
{
  "patient_id": "{some_other_patient_id}",
  "session_id": "{session_id}",
  "slot_id": "{already_booked_slot_id}"
}
```

**Expected**: `409 SLOT_ALREADY_TAKEN`

---

### 7.5 GET /appointments — ✅ List appointments

| | |
|---|---|
| **URL** | `{{baseUrl}}/appointments` |

---

### 7.6 GET /appointments?status=booked — ✅ Filter by status

---

### 7.7 GET /appointments/today — ✅ Today's appointments

| | |
|---|---|
| **URL** | `{{baseUrl}}/appointments/today` |

**Expected**: `200 OK` — may be empty if session is on a future date

---

### 7.8 GET /appointments/:id — ✅ Get appointment details

| | |
|---|---|
| **URL** | `{{baseUrl}}/appointments/{appointment_id}` |

**Expected**: `200 OK` — full details + logs

---

### 7.9 PATCH /appointments/:id/status — ✅ Confirm

| | |
|---|---|
| **Method** | PATCH |
| **URL** | `{{baseUrl}}/appointments/{appointment_id}/status` |

**Body**:
```json
{
  "status": "confirmed",
  "reason": "Patient called to confirm"
}
```

**Expected**: `200 OK`

---

### 7.10 PATCH /appointments/:id/status — ✅ Mark arrived

**Body**:
```json
{
  "status": "arrived"
}
```

**Expected**: `200 OK`

---

### 7.11 PATCH /appointments/:id/status — ✅ Mark completed (Doctor role)

**Body**:
```json
{
  "status": "completed"
}
```

**Expected**: `200 OK`

---

### 7.12 PATCH /appointments/:id/status — ❌ Invalid transition (completed → booked)

**Body**:
```json
{
  "status": "booked"
}
```

**Expected**: `409 INVALID_STATUS_TRANSITION`

---

### 7.13 PATCH /appointments/:id/status — ✅ Cancel 2nd appointment (test slot release)

**Body** (on the second appointment):
```json
{
  "status": "cancelled",
  "reason": "Patient requested cancellation"
}
```

**Expected**: `200 OK`
**Verify**: Check `GET /sessions/{session_id}` — `booked_count` should decrease by 1.

---

### 7.14 GET /sessions/:id/queue — ✅ Queue board

| | |
|---|---|
| **URL** | `{{baseUrl}}/sessions/{session_id}/queue` |

**Expected**: `200 OK` — grouped by waiting/in_clinic/done

---

### 7.15 POST /appointments/:id/reschedule — ✅ Reschedule

*(Book a new appointment first, then reschedule it to the second session)*

**Body**:
```json
{
  "new_session_id": "{second_session_id}"
}
```

**Expected**: `200 OK` — old slot released, new slot assigned, status reset to "booked"

---

### 7.16 GET /appointments/:id/receipt-data — ✅ Receipt data

| | |
|---|---|
| **URL** | `{{baseUrl}}/appointments/{appointment_id}/receipt-data` |

**Expected**: `200 OK` — fee values from the appointment snapshot

---

## MODULE 8 — Payments & Billing

> **Login as**: Receptionist, Accountant, or Super Admin
> **Prerequisite**: A completed appointment from step 7.11

### 8.1 POST /payments — ✅ Create payment

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/payments` |
| **Auth** | Bearer `{{token}}` |

**Body**:
```json
{
  "appointment_id": "{completed_appointment_id}"
}
```

**Expected**: `201 Created`
```json
{
  "data": {
    "payment_id": "...",
    "status": "pending",
    "total_amount": 2500.00,
    "doctor_amount": 2000.00,
    "hospital_amount": 500.00,
    "amount_paid": 0,
    "balance_remaining": 2500.00,
    "receipt_number": "RCP-XXXXXXXX"
  }
}
```

**Save `payment_id`**.

---

### 8.2 POST /payments — ❌ Appointment not completed

Create payment for a "booked" appointment:
```json
{
  "appointment_id": "{non_completed_appointment_id}"
}
```

**Expected**: `409`
```json
{ "success": false, "code": "APPOINTMENT_NOT_COMPLETED" }
```

---

### 8.3 POST /payments — ❌ Duplicate payment

**Body** (same appointment_id as 8.1):
```json
{
  "appointment_id": "{completed_appointment_id}"
}
```

**Expected**: `409 PAYMENT_ALREADY_EXISTS`

---

### 8.4 POST /payments/:id/transactions — ✅ Partial cash payment

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/payments/{payment_id}/transactions` |

**Body**:
```json
{
  "method": "cash",
  "amount": 1000.00,
  "note": "Initial payment"
}
```

**Expected**: `200 OK`
```json
{
  "data": {
    "status": "partial",
    "amount_paid": 1000.00,
    "balance_remaining": 1500.00,
    "transactions": [
      { "method": "cash", "amount": 1000.00, "direction": "credit" }
    ]
  }
}
```

---

### 8.5 POST /payments/:id/transactions — ✅ Card payment (remaining balance)

**Body**:
```json
{
  "method": "card",
  "amount": 1500.00,
  "reference": "4532",
  "note": "Visa ending 4532"
}
```

**Expected**: `200 OK`
```json
{
  "data": {
    "status": "paid",
    "amount_paid": 2500.00,
    "balance_remaining": 0,
    "transactions": [
      { "method": "cash", "amount": 1000.00 },
      { "method": "card", "amount": 1500.00 }
    ]
  }
}
```

---

### 8.6 POST /payments/:id/transactions — ❌ Already fully paid

**Body**:
```json
{
  "method": "cash",
  "amount": 100.00
}
```

**Expected**: `409 PAYMENT_ALREADY_COMPLETED`

---

### 8.7 POST /payments/:id/transactions — ❌ Overpayment

*(Test this on a NEW pending payment)*

**Body** (amount > total):
```json
{
  "method": "cash",
  "amount": 99999.00
}
```

**Expected**: `400 AMOUNT_EXCEEDS_BALANCE`

---

### 8.8 POST /payments/:id/transactions — ❌ Invalid method

**Body**:
```json
{
  "method": "bitcoin",
  "amount": 100.00
}
```

**Expected**: `422` — "Method must be cash, card, online, or insurance"

---

### 8.9 POST /payments/:id/refund — ✅ Partial refund

| | |
|---|---|
| **Method** | POST |
| **URL** | `{{baseUrl}}/payments/{payment_id}/refund` |

**Body**:
```json
{
  "amount": 500.00,
  "method": "cash",
  "reason": "Patient overcharged due to billing error"
}
```

**Expected**: `200 OK`
```json
{
  "data": {
    "status": "partial",
    "amount_paid": 2000.00,
    "transactions": [
      { "direction": "credit", "amount": 1000.00 },
      { "direction": "credit", "amount": 1500.00 },
      { "direction": "debit", "amount": 500.00 }
    ]
  }
}
```

---

### 8.10 POST /payments/:id/refund — ❌ Refund exceeds paid amount

**Body**:
```json
{
  "amount": 99999.00,
  "method": "cash",
  "reason": "Way too much"
}
```

**Expected**: `400 REFUND_EXCEEDS_PAID`

---

### 8.11 POST /payments/:id/refund — ❌ Missing reason

**Body**:
```json
{
  "amount": 100.00,
  "method": "cash"
}
```

**Expected**: `422` — "Reason is required for refunds"

---

### 8.12 GET /payments/:id — ✅ Get payment details

| | |
|---|---|
| **URL** | `{{baseUrl}}/payments/{payment_id}` |

**Expected**: `200 OK` — full payment + all transactions + appointment summary + receipt_number

---

### 8.13 GET /payments/appointment/:appointment_id — ✅ Look up payment by appointment

| | |
|---|---|
| **URL** | `{{baseUrl}}/payments/appointment/{appointment_id}` |

**Expected**: `200 OK` — same as 8.12

---

### 8.14 GET /payments/appointment/:appointment_id — ❌ No payment exists

| | |
|---|---|
| **URL** | `{{baseUrl}}/payments/appointment/{appointment_with_no_payment}` |

**Expected**: `404 PAYMENT_NOT_FOUND`

---

### 8.15 GET /payments — ✅ List all payments

| | |
|---|---|
| **URL** | `{{baseUrl}}/payments` |
| **Auth** | Bearer `{{token}}` (Accountant/Admin) |

**Expected**: `200 OK` — paginated list

---

### 8.16 GET /payments?status=paid — ✅ Filter by status

---

## MODULE 9 — Revenue Reports

> **Login as**: Accountant, Hospital Admin, or Super Admin

### 9.1 GET /reports/revenue/summary — ✅ Dashboard summary

| | |
|---|---|
| **URL** | `{{baseUrl}}/reports/revenue/summary` |

**Expected**: `200 OK`
```json
{
  "data": {
    "today": { "collected": 2500, "appointments_billed": 1, "appointments_pending": 0 },
    "this_month": { "collected": 2500, "net_revenue": 2000, "doctor_revenue": 2000, "hospital_revenue": 500 }
  }
}
```

---

### 9.2 GET /reports/revenue/daily — ✅ Daily report

| | |
|---|---|
| **URL** | `{{baseUrl}}/reports/revenue/daily?date=2026-05-05` |

**Expected**: `200 OK` — breakdown by method + payment list

---

### 9.3 GET /reports/revenue/daily — ✅ Default (today)

| | |
|---|---|
| **URL** | `{{baseUrl}}/reports/revenue/daily` |

**Expected**: `200 OK` — defaults to today's date

---

### 9.4 GET /reports/revenue/monthly — ✅ Monthly report

| | |
|---|---|
| **URL** | `{{baseUrl}}/reports/revenue/monthly?year=2026&month=5` |

**Expected**: `200 OK` — by_day array + by_method + top_doctors

---

### 9.5 GET /reports/revenue/monthly — ✅ Default (current month)

| | |
|---|---|
| **URL** | `{{baseUrl}}/reports/revenue/monthly` |

---

### 9.6 GET /reports/revenue/doctor — ✅ Doctor revenue

| | |
|---|---|
| **URL** | `{{baseUrl}}/reports/revenue/doctor?doctor_id={doctor_id}` |

**Expected**: `200 OK` — doctor earnings breakdown

---

### 9.7 GET /reports/revenue/doctor — ❌ Missing doctor_id

| | |
|---|---|
| **URL** | `{{baseUrl}}/reports/revenue/doctor` |

**Expected**: `422` — "Doctor ID is required"

---

### 9.8 GET /reports/revenue/doctor — ❌ Non-existent doctor

| | |
|---|---|
| **URL** | `{{baseUrl}}/reports/revenue/doctor?doctor_id=00000000-0000-0000-0000-000000000099` |

**Expected**: `404 DOCTOR_NOT_FOUND`

---

## Postman Environment Variables

Set these up to make testing easier:

| Variable | Value | Set When |
|---|---|---|
| `baseUrl` | `http://localhost:5000/api/v1` | Once |
| `token` | `eyJhbGciOi...` | After each login |
| `patient_id` | UUID | After creating first patient |
| `patient_id_2` | UUID | After creating second patient |
| `doctor_id` | UUID | After creating first doctor |
| `branch_id` | UUID | From database query |
| `session_id` | UUID | After creating first session |
| `session_id_2` | UUID | After creating second session |
| `appointment_id` | UUID | After booking first appointment |
| `payment_id` | UUID | After creating first payment |

---

## Testing Checklist

- [ ] Health check
- [ ] Login (success + failures)
- [ ] Token refresh
- [ ] Logout
- [ ] List permissions
- [ ] Create/update/delete roles
- [ ] Create users with different roles
- [ ] Role-based access denied
- [ ] Create patients (+ duplicates, validation)
- [ ] Search patients
- [ ] Create doctors with fees
- [ ] Set availability + exceptions
- [ ] Hospital charges
- [ ] Create sessions + slots
- [ ] Session status transitions
- [ ] Book appointments (auto + manual slot)
- [ ] Appointment status flow (booked → confirmed → arrived → completed)
- [ ] Cancellation + slot release
- [ ] Rescheduling
- [ ] Queue board
- [ ] Create payment (only for completed)
- [ ] Partial + full payment
- [ ] Refund (partial)
- [ ] Revenue reports (daily, monthly, doctor, summary)

---

*End of Postman Testing Guide*
