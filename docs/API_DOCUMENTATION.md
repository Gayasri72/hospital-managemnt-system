# Hospital Management System — Backend API Documentation

> **Audience**: Frontend developers building the React JS client.
> **Version**: 1.0 — covers Auth, Patients, Doctors, Sessions, Appointments.

---

## SECTION 1 — Getting Started

### 1.1 Base URL & Environment

| Environment | Base URL |
|---|---|
| Development | `http://localhost:5000/api/v1` |
| Production | `https://your-domain.com/api/v1` |

Set the base URL via the `VITE_API_URL` environment variable in your React app.

### 1.2 Authentication Overview

The system uses **JWT access tokens** + **httpOnly refresh token cookies**.

**Login flow:**
1. Call `POST /auth/login` with email + password
2. Backend returns `accessToken` in the JSON body and sets a `refreshToken` as an httpOnly cookie
3. Store `accessToken` **in memory only** (React state / Zustand / Context) — **NEVER in localStorage** (XSS risk)
4. Every protected request must include: `Authorization: Bearer <accessToken>`
5. The refresh token cookie is sent automatically by the browser (`withCredentials: true`)

**Token refresh flow:**
1. When any request returns `401`, call `POST /auth/refresh`
2. Backend validates the refresh cookie and returns a new `accessToken`
3. Retry the original failed request with the new token
4. If refresh also fails → redirect to login

**Logout:**
1. Call `POST /auth/logout` to clear the cookie server-side
2. Discard `accessToken` from memory

### 1.3 Standard Response Format

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { }
}
```

**Paginated success:**
```json
{
  "success": true,
  "message": "Items retrieved successfully",
  "data": [ ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Human readable error message",
  "code": "ERROR_CODE"
}
```

**Validation error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "path": "email", "message": "Please provide a valid email address" }
  ]
}
```

### 1.4 HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created (new resource) |
| `400` | Bad request / validation error |
| `401` | Unauthorized (missing or expired token) |
| `403` | Forbidden (role not allowed) |
| `404` | Resource not found |
| `409` | Conflict (duplicate, invalid transition) |
| `429` | Rate limited (too many requests) |
| `500` | Internal server error |

### 1.5 Role-Based Access

There are **5 roles** in the system:

| Role | Access Level |
|---|---|
| **Super Admin** | Full system access, all hospitals |
| **Hospital Admin** | Full access within their hospital |
| **Receptionist** | Patient registration, appointment booking, queue management |
| **Doctor** | View own appointments, mark arrived → completed |
| **Accountant** | View receipts and financial data |

The logged-in user's role comes from the JWT payload:

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "Receptionist",
  "hospitalId": "660e8400-e29b-41d4-a716-446655440001",
  "email": "user@hospital.com",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Use the `role` field to show/hide UI elements.** Backend enforces access — frontend hiding is UX only.

### 1.6 Axios Setup Recommendation

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // required for refresh token cookie
});

let accessToken = null;

export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;

// Attach access token to every request
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const res = await api.post('/auth/refresh');
        const newToken = res.data.data.accessToken;
        setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 1.7 Rate Limiting

- **Login endpoint**: max 10 requests per 15 minutes per IP
- On `429` response, show: *"Too many login attempts. Please wait 15 minutes."*

---

## SECTION 2 — Auth Endpoints

### POST /auth/login

| | |
|---|---|
| **Description** | Authenticate user and receive tokens |
| **Access** | Public |

**Request body:**
```json
{
  "email": "receptionist@hospital.com",
  "password": "SecurePass123"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | ✅ | Valid email format |
| `password` | string | ✅ | Min 1 character |

**Success response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Saman Kumara",
      "email": "receptionist@hospital.com",
      "role": "Receptionist",
      "hospital_id": "660e8400-e29b-41d4-a716-446655440001"
    }
  }
}
```

**Error codes:** `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`

**Notes:**
- Store `accessToken` in memory only
- `refreshToken` cookie is set automatically (httpOnly, secure in production)
- Rate limited: 10 attempts per 15 minutes

---

### POST /auth/refresh

| | |
|---|---|
| **Description** | Get a new access token using the refresh cookie |
| **Access** | Public (uses httpOnly cookie) |

**Request body:** None

**Success response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error codes:** `401` if no valid refresh cookie

**Notes:** Call this when any API request returns `401`. The Axios interceptor handles this automatically.

---

### POST /auth/logout

| | |
|---|---|
| **Description** | Invalidate refresh token and clear cookie |
| **Access** | All authenticated roles |

**Request body:** None
**Headers:** `Authorization: Bearer <accessToken>`

**Success response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Notes:** After logout, discard `accessToken` from memory and redirect to login.

---

### GET /auth/me

| | |
|---|---|
| **Description** | Get current authenticated user's details |
| **Access** | All authenticated roles |

**Headers:** `Authorization: Bearer <accessToken>`

**Success response (200):**
```json
{
  "success": true,
  "message": "User details retrieved successfully",
  "data": {
    "user": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Saman Kumara",
      "email": "receptionist@hospital.com",
      "role": "Receptionist",
      "hospital_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_at": "2026-01-15T08:00:00.000Z"
    }
  }
}
```

---

## SECTION 3 — Patient Endpoints

### POST /patients

| | |
|---|---|
| **Description** | Register a new patient |
| **Access** | Receptionist, Hospital Admin, Super Admin |

**Request body:**
```json
{
  "name": "Kamal Perera",
  "nic": "901234567V",
  "phone": "0771234567",
  "email": "kamal@email.com",
  "address": "123 Main St, Colombo",
  "emergency_contact": "0779876543",
  "gender": "Male",
  "age": 35
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | ✅ | Min 2 characters |
| `nic` | string | ✅ | Unique per hospital |
| `phone` | string | ✅ | |
| `email` | string | ❌ | Valid email if provided |
| `address` | string | ❌ | |
| `emergency_contact` | string | ❌ | |
| `gender` | string | ❌ | `Male`, `Female`, or `Other` |
| `age` | integer | ❌ | 0–120 |

**Success response (201):**
```json
{
  "success": true,
  "message": "Patient created successfully",
  "data": {
    "patient_id": "770e8400-e29b-41d4-a716-446655440010",
    "hospital_id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Kamal Perera",
    "nic": "901234567V",
    "phone": "0771234567",
    "email": "kamal@email.com",
    "created_at": "2026-03-01T10:00:00.000Z",
    "profile": {
      "address": "123 Main St, Colombo",
      "emergency_contact": "0779876543",
      "gender": "Male",
      "age": 35
    }
  }
}
```

**Error codes:** `PATIENT_NIC_EXISTS`

**Notes:** `hospital_id` is automatically set from the JWT — never send it in the body. NIC uniqueness is scoped per hospital.

---

### GET /patients

| | |
|---|---|
| **Description** | Search and list patients with pagination |
| **Access** | Receptionist, Doctor, Hospital Admin, Super Admin |

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `search` | string | — | Search by name, NIC, or phone |
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page (max 100) |

**Example:** `GET /patients?search=kamal&page=1&limit=20`

**Success response (200):**
```json
{
  "success": true,
  "message": "Patients retrieved successfully",
  "data": [
    {
      "patient_id": "770e8400-...",
      "name": "Kamal Perera",
      "nic": "901234567V",
      "phone": "0771234567",
      "email": "kamal@email.com",
      "created_at": "2026-03-01T10:00:00.000Z"
    }
  ],
  "meta": { "total": 45, "page": 1, "limit": 20 }
}
```

---

### GET /patients/:id

| | |
|---|---|
| **Description** | Get a single patient with profile details |
| **Access** | All authenticated roles |

**Success response (200):**
```json
{
  "success": true,
  "message": "Patient retrieved successfully",
  "data": {
    "patient_id": "770e8400-...",
    "hospital_id": "660e8400-...",
    "name": "Kamal Perera",
    "nic": "901234567V",
    "phone": "0771234567",
    "email": "kamal@email.com",
    "created_at": "2026-03-01T10:00:00.000Z",
    "profile": {
      "address": "123 Main St, Colombo",
      "emergency_contact": "0779876543",
      "gender": "Male",
      "age": 35
    }
  }
}
```

**Error codes:** `PATIENT_NOT_FOUND`

---

### PUT /patients/:id

| | |
|---|---|
| **Description** | Update patient details (partial update) |
| **Access** | Receptionist, Hospital Admin |

**Request body (all fields optional):**
```json
{
  "name": "Kamal P. Perera",
  "phone": "0771234999",
  "email": "kamal.new@email.com",
  "address": "456 New St, Colombo",
  "emergency_contact": "0779876999",
  "gender": "Male",
  "age": 36
}
```

> **Note:** NIC cannot be updated after registration.

**Error codes:** `PATIENT_NOT_FOUND`

---

### GET /patients/:id/appointments

| | |
|---|---|
| **Description** | Get appointment history for a patient |
| **Access** | Receptionist, Doctor, Hospital Admin |

**Success response (200):**
```json
{
  "success": true,
  "message": "Patient appointments retrieved successfully",
  "data": [
    {
      "appointment_id": "880e8400-...",
      "queue_number": 3,
      "status": "completed",
      "doctor_fee": 2000.00,
      "hospital_charge": 500.00,
      "total_fee": 2500.00,
      "created_at": "2026-03-15T10:30:00.000Z"
    }
  ]
}
```

**Error codes:** `PATIENT_NOT_FOUND`

---

## SECTION 4 — Doctor Endpoints

### POST /doctors

| | |
|---|---|
| **Description** | Register a new doctor with profile and initial fee |
| **Access** | Hospital Admin, Super Admin |

**Request body:**
```json
{
  "name": "Dr. Nimal Silva",
  "specialization": "Cardiologist",
  "contact_number": "0112345678",
  "email": "nimal@hospital.com",
  "qualifications": "MBBS, MD (Cardiology)",
  "experience": "12 years",
  "bio": "Senior cardiologist with expertise in interventional procedures",
  "consultation_fee": 2000.00,
  "effective_from": "2026-01-01"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | ✅ | Min 2 characters |
| `specialization` | string | ✅ | Min 1 character |
| `contact_number` | string | ❌ | |
| `email` | string | ❌ | Valid email |
| `qualifications` | string | ❌ | |
| `experience` | string | ❌ | |
| `bio` | string | ❌ | |
| `consultation_fee` | number | ✅ | ≥ 0 |
| `effective_from` | string | ❌ | Valid date (defaults to today) |

**Success response (201):**
```json
{
  "success": true,
  "message": "Doctor created successfully",
  "data": {
    "doctor_id": "990e8400-e29b-41d4-a716-446655440020",
    "hospital_id": "660e8400-...",
    "name": "Dr. Nimal Silva",
    "specialization": "Cardiologist",
    "status": "active",
    "created_at": "2026-03-01T08:00:00.000Z",
    "profile": {
      "contact_number": "0112345678",
      "email": "nimal@hospital.com",
      "qualifications": "MBBS, MD (Cardiology)",
      "experience": "12 years",
      "bio": "Senior cardiologist..."
    },
    "fees": [
      { "fee_id": "...", "consultation_fee": 2000.00, "effective_from": "2026-01-01" }
    ]
  }
}
```

**Notes:** Creates doctor + profile + initial fee entry in a single transaction.

---

### GET /doctors

| | |
|---|---|
| **Description** | List doctors with search, filters, and pagination |
| **Access** | All authenticated roles |

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `search` | string | — | Search by name |
| `specialization` | string | — | Filter by specialization |
| `status` | string | `active` | `active` or `inactive` |
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page (max 100) |

**Example:** `GET /doctors?specialization=Cardiologist&page=1`

**Success response (200):**
```json
{
  "success": true,
  "message": "Doctors retrieved successfully",
  "data": [
    {
      "doctor_id": "990e8400-...",
      "name": "Dr. Nimal Silva",
      "specialization": "Cardiologist",
      "status": "active",
      "profile": {
        "contact_number": "0112345678",
        "email": "nimal@hospital.com"
      }
    }
  ],
  "meta": { "total": 12, "page": 1, "limit": 20 }
}
```

---

### GET /doctors/:id

| | |
|---|---|
| **Description** | Get full doctor details with profile, current fee, and hospital charge |
| **Access** | All authenticated roles |

**Success response (200):**
```json
{
  "success": true,
  "message": "Doctor retrieved successfully",
  "data": {
    "doctor_id": "990e8400-...",
    "hospital_id": "660e8400-...",
    "name": "Dr. Nimal Silva",
    "specialization": "Cardiologist",
    "status": "active",
    "profile": {
      "contact_number": "0112345678",
      "email": "nimal@hospital.com",
      "qualifications": "MBBS, MD (Cardiology)",
      "experience": "12 years",
      "bio": "Senior cardiologist..."
    },
    "current_fee": {
      "consultation_fee": 2000.00,
      "effective_from": "2026-01-01"
    },
    "hospital_charge": 500.00,
    "total_fee": 2500.00
  }
}
```

**Error codes:** `DOCTOR_NOT_FOUND`

---

### PUT /doctors/:id

| | |
|---|---|
| **Description** | Update doctor details (partial update) |
| **Access** | Hospital Admin, Super Admin |

**Request body (all fields optional):**
```json
{
  "name": "Dr. Nimal D. Silva",
  "specialization": "Interventional Cardiologist",
  "contact_number": "0112345999",
  "email": "nimal.new@hospital.com",
  "qualifications": "MBBS, MD, MRCP",
  "experience": "14 years",
  "bio": "Updated bio...",
  "status": "inactive"
}
```

**Error codes:** `DOCTOR_NOT_FOUND`, `DOCTOR_HAS_FUTURE_SESSIONS` (when deactivating)

**Notes:** Cannot deactivate a doctor who has future sessions. Cancel sessions first.

---

### POST /doctors/:id/fees

| | |
|---|---|
| **Description** | Add a new fee entry (immutable history — always inserts, never updates) |
| **Access** | Hospital Admin, Super Admin |

**Request body:**
```json
{
  "consultation_fee": 2500.00,
  "effective_from": "2026-04-01"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `consultation_fee` | number | ✅ | ≥ 0 |
| `effective_from` | string | ❌ | Valid date (defaults to today) |

**Error codes:** `DOCTOR_NOT_FOUND`, `FEE_MUST_BE_POSITIVE`

**Notes:** Fees are immutable history. Each new entry takes effect from its `effective_from` date. Old fees remain for historical appointments.

---

### GET /doctors/:id/fees

| | |
|---|---|
| **Description** | Get full fee history for a doctor |
| **Access** | Hospital Admin, Accountant, Super Admin |

**Success response (200):**
```json
{
  "success": true,
  "message": "Fee history retrieved successfully",
  "data": [
    { "fee_id": "...", "consultation_fee": 2500.00, "effective_from": "2026-04-01", "created_at": "..." },
    { "fee_id": "...", "consultation_fee": 2000.00, "effective_from": "2026-01-01", "created_at": "..." }
  ]
}
```

---

### POST /hospital/charges

| | |
|---|---|
| **Description** | Add a new hospital service charge (immutable history) |
| **Access** | Hospital Admin, Super Admin |

**Request body:**
```json
{
  "charge_amount": 500.00,
  "effective_from": "2026-01-01"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `charge_amount` | number | ✅ | ≥ 0 |
| `effective_from` | string | ❌ | Valid date (defaults to today) |

---

### GET /hospital/charges/current

| | |
|---|---|
| **Description** | Get current effective hospital charge |
| **Access** | All authenticated roles |

**Success response (200):**
```json
{
  "success": true,
  "message": "Current hospital charge retrieved successfully",
  "data": {
    "charge_id": "...",
    "charge_amount": 500.00,
    "effective_from": "2026-01-01",
    "created_at": "..."
  }
}
```

---

### POST /doctors/:id/availability

| | |
|---|---|
| **Description** | Set weekly recurring schedule (full replace) |
| **Access** | Hospital Admin, Super Admin |

**Request body:**
```json
{
  "schedule": [
    { "day_of_week": "Monday", "start_time": "18:00", "end_time": "21:00" },
    { "day_of_week": "Wednesday", "start_time": "18:00", "end_time": "21:00" },
    { "day_of_week": "Saturday", "start_time": "09:00", "end_time": "13:00" }
  ]
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `schedule` | array | ✅ | Min 1 item |
| `schedule[].day_of_week` | string | ✅ | Monday–Sunday |
| `schedule[].start_time` | string | ✅ | HH:MM format (24h) |
| `schedule[].end_time` | string | ✅ | HH:MM format, must be after start_time |

**Error codes:** `DOCTOR_NOT_FOUND`, `DUPLICATE_DAY_IN_SCHEDULE`, `INVALID_TIME_RANGE`

**Notes:** This **replaces the entire schedule**. Send all days the doctor works.

---

### GET /doctors/:id/availability

| | |
|---|---|
| **Description** | Get doctor's weekly recurring schedule |
| **Access** | All authenticated roles |

**Success response (200):**
```json
{
  "success": true,
  "message": "Availability retrieved successfully",
  "data": [
    { "availability_id": "...", "day_of_week": "Monday", "start_time": "18:00", "end_time": "21:00" },
    { "availability_id": "...", "day_of_week": "Wednesday", "start_time": "18:00", "end_time": "21:00" }
  ]
}
```

---

### POST /doctors/:id/exceptions

| | |
|---|---|
| **Description** | Add a leave/exception date for a doctor |
| **Access** | Hospital Admin, Super Admin, Receptionist |

**Request body:**
```json
{
  "exception_date": "2026-04-14",
  "reason": "Sinhala New Year holiday"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `exception_date` | string | ✅ | Valid future date |
| `reason` | string | ❌ | |

**Error codes:** `DOCTOR_NOT_FOUND`, `DOCTOR_EXCEPTION_CONFLICT` (if bookings exist on that date)

---

### GET /doctors/:id/exceptions

| | |
|---|---|
| **Description** | List exception dates for a doctor |
| **Access** | All authenticated roles |

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `from` | string | Start date filter |
| `to` | string | End date filter |

**Success response (200):**
```json
{
  "success": true,
  "data": [
    { "exception_id": "...", "exception_date": "2026-04-14", "reason": "Sinhala New Year", "created_at": "..." }
  ]
}
```

---

### DELETE /doctors/:id/exceptions/:exception_id

| | |
|---|---|
| **Description** | Remove an exception date |
| **Access** | Hospital Admin, Super Admin |

**Success response (200):**
```json
{ "success": true, "message": "Exception removed successfully" }
```

---

### GET /doctors/:id/sessions

| | |
|---|---|
| **Description** | List all sessions for a specific doctor |
| **Access** | All authenticated roles |

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `from` | string | Start date filter |
| `to` | string | End date filter |
| `status` | string | Filter by session status |

**Success response (200):**
```json
{
  "success": true,
  "data": [
    {
      "session_id": "...",
      "session_date": "2026-04-07",
      "start_time": "18:00",
      "end_time": "21:00",
      "max_patients": 18,
      "booked_count": 5,
      "status": "open",
      "branch": { "name": "Colombo Branch", "location": "Colombo 03" }
    }
  ]
}
```

---

## SECTION 5 — Session Endpoints

### POST /sessions

| | |
|---|---|
| **Description** | Create a new channeling session with auto-generated slots |
| **Access** | Hospital Admin, Super Admin |

**Request body:**
```json
{
  "doctor_id": "990e8400-...",
  "branch_id": "aa0e8400-...",
  "session_date": "2026-04-07",
  "start_time": "18:00",
  "end_time": "21:00",
  "slot_duration": 10,
  "max_patients": 18
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `doctor_id` | UUID | ✅ | Must belong to your hospital |
| `branch_id` | UUID | ✅ | Must belong to your hospital |
| `session_date` | string | ✅ | Valid date, not in the past |
| `start_time` | string | ✅ | HH:MM format |
| `end_time` | string | ✅ | HH:MM format, after start_time |
| `slot_duration` | integer | ❌ | Default: 10 (minutes) |
| `max_patients` | integer | ❌ | Auto-calculated from time range if omitted |

**Success response (201):**
```json
{
  "success": true,
  "message": "Session created successfully",
  "data": {
    "session_id": "bb0e8400-...",
    "doctor_id": "990e8400-...",
    "branch_id": "aa0e8400-...",
    "session_date": "2026-04-07",
    "start_time": "18:00",
    "end_time": "21:00",
    "slot_duration": 10,
    "max_patients": 18,
    "booked_count": 0,
    "status": "scheduled",
    "slots": [
      { "slot_id": "...", "slot_number": 1, "slot_time": "18:00", "is_booked": false },
      { "slot_id": "...", "slot_number": 2, "slot_time": "18:10", "is_booked": false },
      { "slot_id": "...", "slot_number": 3, "slot_time": "18:20", "is_booked": false }
    ],
    "warning": "Outside doctor's regular schedule. Monday is not in their availability."
  }
}
```

**Error codes:** `DOCTOR_NOT_FOUND`, `BRANCH_NOT_FOUND`, `DOCTOR_INACTIVE`, `SESSION_OVERLAP`, `SESSION_ON_EXCEPTION_DATE`, `INVALID_TIME_RANGE`

**Notes:**
- `warning` field appears if session is outside doctor's regular availability (soft warning, not blocking)
- `max_patients` auto-calculated as `(end - start) / slot_duration` if omitted
- Slots are auto-generated with sequential slot_numbers and times

---

### GET /sessions

| | |
|---|---|
| **Description** | List sessions with filters and pagination |
| **Access** | All authenticated roles |

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `doctor_id` | UUID | — | Filter by doctor |
| `branch_id` | UUID | — | Filter by branch |
| `date` | string | — | Exact date |
| `from` | string | — | Date range start |
| `to` | string | — | Date range end |
| `status` | string | — | `scheduled`, `open`, `full`, `closed`, `cancelled` |
| `page` | integer | 1 | |
| `limit` | integer | 20 | Max 100 |

---

### GET /sessions/:id

| | |
|---|---|
| **Description** | Get full session details with doctor, branch, and all slots |
| **Access** | All authenticated roles |

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "session_id": "bb0e8400-...",
    "doctor": { "name": "Dr. Nimal Silva", "specialization": "Cardiologist" },
    "branch": { "name": "Colombo Branch", "location": "Colombo 03" },
    "session_date": "2026-04-07",
    "start_time": "18:00",
    "end_time": "21:00",
    "slot_duration": 10,
    "max_patients": 18,
    "booked_count": 5,
    "status": "open",
    "slots": [
      { "slot_id": "...", "slot_number": 1, "slot_time": "18:00", "is_booked": true },
      { "slot_id": "...", "slot_number": 2, "slot_time": "18:10", "is_booked": false }
    ]
  }
}
```

**Error codes:** `SESSION_NOT_FOUND`

---

### PUT /sessions/:id

| | |
|---|---|
| **Description** | Update session details (only when status is `scheduled`) |
| **Access** | Hospital Admin, Super Admin |

**Request body (all fields optional):**
```json
{
  "start_time": "17:30",
  "end_time": "20:30",
  "slot_duration": 15,
  "max_patients": 12
}
```

**Error codes:** `SESSION_NOT_FOUND`, `SESSION_ALREADY_OPEN`, `SESSION_HAS_BOOKINGS`, `CAPACITY_BELOW_BOOKINGS`

**Notes:** Cannot edit once status is `open`, `full`, `closed`, or `cancelled`. Cannot change times if bookings exist. Cannot reduce max_patients below current booked_count.

---

### PATCH /sessions/:id/status

| | |
|---|---|
| **Description** | Transition session status |
| **Access** | Hospital Admin, Super Admin, Receptionist |

**Request body:**
```json
{ "status": "open" }
```

**Status transition table:**

| From | To | Who Can Do It |
|---|---|---|
| `scheduled` | `open` | Hospital Admin, Super Admin |
| `scheduled` | `cancelled` | Hospital Admin, Super Admin |
| `open` | `closed` | Hospital Admin, Super Admin, Receptionist |
| `open` | `cancelled` | Hospital Admin, Super Admin (only if 0 bookings) |
| `full` | `closed` | Hospital Admin, Super Admin, Receptionist |
| `closed` | — | Terminal (no transitions) |
| `cancelled` | — | Terminal (no transitions) |

**Error codes:** `SESSION_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `SESSION_HAS_BOOKINGS`

---

### DELETE /sessions/:id

| | |
|---|---|
| **Description** | Delete a session (only when `scheduled` with 0 bookings) |
| **Access** | Hospital Admin, Super Admin |

**Error codes:** `SESSION_NOT_FOUND`, `SESSION_ALREADY_OPEN`, `SESSION_HAS_BOOKINGS`

---

### GET /sessions/:id/slots

| | |
|---|---|
| **Description** | Get all slots for a session |
| **Access** | All authenticated roles |

**Success response (200):**
```json
{
  "success": true,
  "data": [
    { "slot_id": "...", "slot_number": 1, "slot_time": "18:00", "is_booked": true },
    { "slot_id": "...", "slot_number": 2, "slot_time": "18:10", "is_booked": false },
    { "slot_id": "...", "slot_number": 3, "slot_time": "18:20", "is_booked": false }
  ]
}
```

---

### GET /sessions/available

| | |
|---|---|
| **Description** | Find sessions available for booking (status=open, future date, not full) |
| **Access** | Receptionist, Hospital Admin, Super Admin |

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `doctor_id` | UUID | Filter by doctor |
| `specialization` | string | Filter by doctor's specialization |
| `date` | string | Exact date |
| `from` | string | Date range start |
| `to` | string | Date range end |
| `page` | integer | Default: 1 |
| `limit` | integer | Default: 20 |

**Notes:** Only returns sessions where `status = 'open'` AND `booked_count < max_patients` AND `session_date >= today`.

---

### GET /sessions/:id/queue

| | |
|---|---|
| **Description** | Live queue board — appointments grouped by status |
| **Access** | Receptionist, Doctor, Hospital Admin, Super Admin |

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "waiting": [
      {
        "appointment_id": "...",
        "queue_number": 1,
        "status": "booked",
        "patient": { "name": "Kamal Perera", "phone": "0771234567" },
        "slot": { "slot_time": "18:00" }
      }
    ],
    "in_clinic": [
      {
        "appointment_id": "...",
        "queue_number": 3,
        "status": "arrived",
        "patient": { "name": "Nimal Fernando", "phone": "0779876543" },
        "slot": { "slot_time": "18:20" }
      }
    ],
    "done": [
      {
        "appointment_id": "...",
        "queue_number": 2,
        "status": "completed",
        "patient": { "name": "Sunil Jayawardena", "phone": "0761234567" },
        "slot": { "slot_time": "18:10" }
      }
    ]
  }
}
```

**Notes:** Poll this endpoint every 30 seconds for the live queue board.


---

## SECTION 6 — Appointment Endpoints

### POST /appointments

| | |
|---|---|
| **Description** | Book a new appointment in a session |
| **Access** | Receptionist, Hospital Admin, Super Admin |

**Request body:**
```json
{
  "patient_id": "770e8400-e29b-41d4-a716-446655440010",
  "session_id": "bb0e8400-e29b-41d4-a716-446655440030",
  "slot_id": "cc0e8400-e29b-41d4-a716-446655440040",
  "notes": "Follow-up visit for chest pain"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `patient_id` | UUID | ✅ | Must belong to your hospital |
| `session_id` | UUID | ✅ | Must be status `open` |
| `slot_id` | UUID | ❌ | If omitted, system picks next available slot |
| `notes` | string | ❌ | Max 500 characters |

**Success response (201):**
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "appointment_id": "880e8400-e29b-41d4-a716-446655440050",
    "queue_number": 3,
    "slot_time": "18:20",
    "status": "booked",
    "patient": { "name": "Kamal Perera", "phone": "0771234567" },
    "doctor": { "name": "Dr. Nimal Silva", "specialization": "Cardiologist" },
    "session": {
      "session_date": "2026-04-07",
      "start_time": "18:00",
      "branch_name": "Colombo Branch"
    },
    "doctor_fee": 2000.00,
    "hospital_charge": 500.00,
    "total_fee": 2500.00,
    "created_at": "2026-04-01T10:30:00.000Z"
  }
}
```

**Error codes:**
- `PATIENT_NOT_FOUND` — patient doesn't exist or belongs to another hospital
- `SESSION_NOT_FOUND` — session doesn't exist in your hospital
- `SESSION_NOT_AVAILABLE` — session status is not `open`
- `SESSION_FULL` — all slots are booked
- `SLOT_ALREADY_TAKEN` — the requested slot is already booked
- `SLOT_NOT_IN_SESSION` — slot_id doesn't belong to the session
- `DUPLICATE_APPOINTMENT` — patient already has an active appointment in this session
- `FEE_NOT_CONFIGURED` — no doctor fee or hospital charge set for the session date

**Notes:**
- Fee values are **snapshotted at booking time** from the most recent fee effective on `session_date`
- `queue_number` equals the `slot_number` of the assigned slot
- If `slot_id` is omitted, the system assigns the lowest-numbered available slot

---

### GET /appointments

| | |
|---|---|
| **Description** | List appointments with filters and pagination |
| **Access** | All roles (Doctor role auto-scoped to own appointments) |

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `patient_id` | UUID | — | Filter by patient |
| `doctor_id` | UUID | — | Filter by doctor |
| `session_id` | UUID | — | Filter by session |
| `status` | string | — | `booked`, `confirmed`, `arrived`, `completed`, `cancelled`, `no_show` |
| `date` | string | — | Exact session date |
| `from` | string | — | Date range start |
| `to` | string | — | Date range end |
| `page` | integer | 1 | |
| `limit` | integer | 20 | Max 100 |

**Notes:** Doctors can only see their own appointments — the backend enforces this.

---

### GET /appointments/today

| | |
|---|---|
| **Description** | Today's appointments grouped by session with waiting count |
| **Access** | Receptionist, Doctor, Hospital Admin, Super Admin |

**Success response (200):**
```json
{
  "success": true,
  "data": [
    {
      "session_id": "bb0e8400-...",
      "session": {
        "session_date": "2026-04-07",
        "start_time": "18:00",
        "end_time": "21:00",
        "branch": { "name": "Colombo Branch" }
      },
      "appointments": [
        {
          "appointment_id": "...",
          "queue_number": 1,
          "status": "confirmed",
          "patient": { "name": "Kamal Perera", "phone": "0771234567" },
          "doctor": { "name": "Dr. Nimal Silva", "specialization": "Cardiologist" },
          "slot": { "slot_time": "18:00" }
        }
      ],
      "waiting_count": 8
    }
  ]
}
```

**Notes:** Primary dashboard view. `waiting_count` = appointments with status `booked`, `confirmed`, or `arrived`.

---

### GET /appointments/:id

| | |
|---|---|
| **Description** | Get full appointment details with status history (logs) |
| **Access** | All roles (Doctor scoped to own) |

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "appointment_id": "880e8400-...",
    "queue_number": 3,
    "status": "booked",
    "doctor_fee": 2000.00,
    "hospital_charge": 500.00,
    "total_fee": 2500.00,
    "notes": "Follow-up visit",
    "created_at": "2026-04-01T10:30:00.000Z",
    "updated_at": "2026-04-01T10:30:00.000Z",
    "patient": { "name": "Kamal Perera", "phone": "0771234567", "nic": "901234567V" },
    "doctor": { "name": "Dr. Nimal Silva", "specialization": "Cardiologist" },
    "session": {
      "session_date": "2026-04-07",
      "start_time": "18:00",
      "end_time": "21:00",
      "branch": { "name": "Colombo Branch", "location": "Colombo 03" }
    },
    "slot": { "slot_time": "18:20", "slot_number": 3 },
    "logs": [
      {
        "log_id": "...",
        "old_status": null,
        "new_status": "booked",
        "changed_by": "550e8400-...",
        "reason": null,
        "created_at": "2026-04-01T10:30:00.000Z"
      }
    ]
  }
}
```

**Error codes:** `APPOINTMENT_NOT_FOUND`

---

### PATCH /appointments/:id/status

| | |
|---|---|
| **Description** | Update appointment status with transition validation |
| **Access** | Varies by transition (see table below) |

**Request body:**
```json
{
  "status": "confirmed",
  "reason": "Patient called to confirm"
}
```

| Field | Type | Required |
|---|---|---|
| `status` | string | ✅ |
| `reason` | string | ❌ |

**Status transition table:**

| From | To | Who Can Do It | Releases Slot? |
|---|---|---|---|
| `booked` | `confirmed` | Receptionist, Hospital Admin, Super Admin | No |
| `booked` | `cancelled` | Receptionist, Hospital Admin, Super Admin | ✅ Yes |
| `booked` | `no_show` | Receptionist, Hospital Admin, Super Admin | ✅ Yes |
| `confirmed` | `arrived` | Receptionist, Hospital Admin, Super Admin | No |
| `confirmed` | `cancelled` | Receptionist, Hospital Admin, Super Admin | ✅ Yes |
| `confirmed` | `no_show` | Receptionist, Hospital Admin, Super Admin | ✅ Yes |
| `arrived` | `completed` | **Doctor**, Hospital Admin, Super Admin | No |
| `arrived` | `no_show` | Receptionist, Hospital Admin, Super Admin | ✅ Yes |
| `completed` | — | **Terminal** — no transitions allowed | — |
| `cancelled` | — | **Terminal** — no transitions allowed | — |
| `no_show` | — | **Terminal** — no transitions allowed | — |

**Error codes:** `APPOINTMENT_NOT_FOUND`, `INVALID_STATUS_TRANSITION`

**Notes:**
- On `cancelled` or `no_show`: the slot is released and session `booked_count` is decremented
- If the session was `full`, it reverts to `open` after a cancellation
- Every transition creates an `appointment_log` entry

---

### POST /appointments/:id/reschedule

| | |
|---|---|
| **Description** | Move appointment to a different session (same doctor only) |
| **Access** | Receptionist, Hospital Admin, Super Admin |

**Request body:**
```json
{
  "new_session_id": "dd0e8400-e29b-41d4-a716-446655440060",
  "new_slot_id": "ee0e8400-e29b-41d4-a716-446655440070"
}
```

| Field | Type | Required |
|---|---|---|
| `new_session_id` | UUID | ✅ |
| `new_slot_id` | UUID | ❌ |

**Error codes:**
- `APPOINTMENT_NOT_FOUND`
- `RESCHEDULE_NOT_ALLOWED` — status must be `booked` or `confirmed`
- `RESCHEDULE_DOCTOR_MISMATCH` — new session has a different doctor
- `SESSION_NOT_AVAILABLE` — new session is not `open`
- `SESSION_FULL` — no slots available in new session
- `SLOT_ALREADY_TAKEN` / `SLOT_NOT_IN_SESSION`
- `DUPLICATE_APPOINTMENT` — patient already in new session
- `FEE_NOT_CONFIGURED` — fees not set for new session date

**Notes:**
- Fees are re-snapshotted for the new session date (may differ)
- Old slot is released, new slot is acquired, all in one transaction
- Status resets to `booked` after reschedule

---

### GET /appointments/:id/receipt-data

| | |
|---|---|
| **Description** | Get all data needed to render a payment receipt |
| **Access** | Receptionist, Accountant, Hospital Admin, Super Admin |

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "appointment_id": "880e8400-...",
    "queue_number": 3,
    "doctor_fee": 2000.00,
    "hospital_charge": 500.00,
    "total_fee": 2500.00,
    "status": "completed",
    "created_at": "2026-04-01T10:30:00.000Z",
    "patient": { "name": "Kamal Perera", "nic": "901234567V", "phone": "0771234567" },
    "doctor": { "name": "Dr. Nimal Silva", "specialization": "Cardiologist" },
    "session": {
      "session_date": "2026-04-07",
      "branch": { "name": "Colombo Branch" }
    },
    "slot": { "slot_time": "18:20" }
  }
}
```

**⚠️ CRITICAL:** Fee values come from the **appointment row** (the snapshot at booking time), NOT from the current doctor_fees or hospital_charges tables. This is the source of truth for billing.

---

## SECTION 7 — Data Models Reference

### Hospital

| Field | Type | Required | Constraints |
|---|---|---|---|
| `hospital_id` | UUID | Auto | Primary key |
| `name` | string | ✅ | |
| `created_at` | timestamp | Auto | |

### Branch

| Field | Type | Required | Constraints |
|---|---|---|---|
| `branch_id` | UUID | Auto | Primary key |
| `hospital_id` | UUID | Auto | FK → Hospital |
| `name` | string | ✅ | |
| `location` | string | ❌ | |

### User

| Field | Type | Required | Constraints |
|---|---|---|---|
| `user_id` | UUID | Auto | Primary key |
| `hospital_id` | UUID | Auto | FK → Hospital |
| `name` | string | ✅ | |
| `email` | string | ✅ | Unique |
| `role` | string | ✅ | See roles below |

### Roles (5 total)

`Super Admin` · `Hospital Admin` · `Receptionist` · `Doctor` · `Accountant`

### Patient

| Field | Type | Required | Constraints |
|---|---|---|---|
| `patient_id` | UUID | Auto | Primary key |
| `hospital_id` | UUID | Auto | From JWT |
| `name` | string | ✅ | Min 2 chars |
| `nic` | string | ✅ | Unique per hospital |
| `phone` | string | ✅ | |
| `email` | string | ❌ | Valid email |

### Patient Profile

| Field | Type | Required |
|---|---|---|
| `address` | string | ❌ |
| `emergency_contact` | string | ❌ |
| `gender` | enum | ❌ | `Male`, `Female`, `Other` |
| `age` | integer | ❌ | 0–120 |

### Doctor

| Field | Type | Required | Constraints |
|---|---|---|---|
| `doctor_id` | UUID | Auto | Primary key |
| `hospital_id` | UUID | Auto | From JWT |
| `name` | string | ✅ | Min 2 chars |
| `specialization` | string | ✅ | |
| `status` | enum | Auto | `active` (default), `inactive` |

### Doctor Profile

| Field | Type | Required |
|---|---|---|
| `contact_number` | string | ❌ |
| `email` | string | ❌ |
| `qualifications` | string | ❌ |
| `experience` | string | ❌ |
| `bio` | string | ❌ |

### Doctor Availability

| Field | Type | Required | Constraints |
|---|---|---|---|
| `availability_id` | UUID | Auto | |
| `doctor_id` | UUID | Auto | FK → Doctor |
| `day_of_week` | enum | ✅ | Monday–Sunday |
| `start_time` | string | ✅ | HH:MM (24h) |
| `end_time` | string | ✅ | HH:MM, > start_time |

### Doctor Exception

| Field | Type | Required | Constraints |
|---|---|---|---|
| `exception_id` | UUID | Auto | |
| `doctor_id` | UUID | Auto | FK → Doctor |
| `exception_date` | date | ✅ | Must be future date |
| `reason` | string | ❌ | |

### Doctor Fee (immutable history)

| Field | Type | Required |
|---|---|---|
| `fee_id` | UUID | Auto |
| `doctor_id` | UUID | Auto |
| `consultation_fee` | decimal(10,2) | ✅ |
| `effective_from` | date | ✅ |

### Hospital Charge (immutable history)

| Field | Type | Required |
|---|---|---|
| `charge_id` | UUID | Auto |
| `hospital_id` | UUID | Auto |
| `charge_amount` | decimal(10,2) | ✅ |
| `effective_from` | date | ✅ |

### Channel Session

| Field | Type | Required | Constraints |
|---|---|---|---|
| `session_id` | UUID | Auto | |
| `doctor_id` | UUID | ✅ | FK → Doctor |
| `branch_id` | UUID | ✅ | FK → Branch |
| `hospital_id` | UUID | Auto | From JWT |
| `session_date` | date | ✅ | Not in the past |
| `start_time` | string | ✅ | HH:MM |
| `end_time` | string | ✅ | HH:MM |
| `slot_duration` | integer | ❌ | Default: 10 (minutes) |
| `max_patients` | integer | ❌ | Auto-calc if omitted |
| `booked_count` | integer | Auto | Default: 0 |
| `status` | enum | Auto | `scheduled` → `open` → `full`/`closed`/`cancelled` |

### Session Slot

| Field | Type | Constraints |
|---|---|---|
| `slot_id` | UUID | Auto-generated |
| `session_id` | UUID | FK → Session |
| `slot_number` | integer | Sequential (1, 2, 3...) |
| `slot_time` | string | HH:MM |
| `is_booked` | boolean | Default: false |

### Appointment

| Field | Type | Required | Constraints |
|---|---|---|---|
| `appointment_id` | UUID | Auto | |
| `hospital_id` | UUID | Auto | From JWT |
| `patient_id` | UUID | ✅ | FK → Patient |
| `doctor_id` | UUID | Auto | From session |
| `session_id` | UUID | ✅ | FK → Session |
| `slot_id` | UUID | Auto | FK → Slot |
| `queue_number` | integer | Auto | = slot_number |
| `status` | enum | Auto | `booked` → see transition table |
| `doctor_fee` | decimal(10,2) | Auto | Snapshot at booking |
| `hospital_charge` | decimal(10,2) | Auto | Snapshot at booking |
| `total_fee` | decimal(10,2) | Auto | doctor_fee + hospital_charge |
| `notes` | string | ❌ | Max 500 chars |
| `booked_by` | UUID | Auto | From JWT |

### Appointment Log

| Field | Type | Description |
|---|---|---|
| `log_id` | UUID | Auto |
| `appointment_id` | UUID | FK → Appointment |
| `old_status` | string | null on first entry |
| `new_status` | string | New status value |
| `changed_by` | UUID | User who made the change |
| `reason` | string | Optional free text |
| `metadata` | JSON | Context (slot_time, session info) |
| `created_at` | timestamp | Auto |

---

## SECTION 8 — UI Pages & Which Endpoints They Use

### Login Page
- `POST /auth/login`
- On success: store token in memory, redirect based on role

### Dashboard (role-dependent)
- `GET /appointments/today` — today's schedule
- `GET /sessions/available` — available sessions count

### Patient Registration Form
- `POST /patients`

### Patient Search / List
- `GET /patients?search=<query>&page=1&limit=20`

### Patient Profile View
- `GET /patients/:id`
- `GET /patients/:id/appointments`

### Doctor List
- `GET /doctors?search=&specialization=&status=active`

### Doctor Profile View
- `GET /doctors/:id`
- `GET /doctors/:id/availability`
- `GET /doctors/:id/exceptions`

### Doctor Registration Form (Admin only)
- `POST /doctors`
- `POST /doctors/:id/availability` (set schedule after creation)

### Session Creation Form (Admin only)
- `GET /doctors` (pick doctor dropdown)
- `GET /doctors/:id/availability` (suggest valid days)
- `GET /doctors/:id/exceptions` (warn on exception dates)
- `POST /sessions`

### Session List / Calendar View
- `GET /sessions?from=2026-04-01&to=2026-04-30`

### Appointment Booking Form
- `GET /sessions/available` (pick session)
- `GET /sessions/:id/slots` (show available slots)
- `POST /appointments`

### Queue Management Board (live session view)
- `GET /sessions/:id/queue` (poll every 30 seconds)
- `PATCH /appointments/:id/status` (update status)

### Appointment Detail View
- `GET /appointments/:id`

### Rescheduling Form
- `GET /sessions/available` (pick new session)
- `POST /appointments/:id/reschedule`

### Receipt View / Print
- `GET /appointments/:id/receipt-data`

### Doctor Schedule Management (Admin)
- `GET /doctors/:id/availability`
- `POST /doctors/:id/availability` (full replace)
- `POST /doctors/:id/exceptions`
- `DELETE /doctors/:id/exceptions/:exception_id`

### Fee Management (Admin)
- `POST /doctors/:id/fees`
- `GET /doctors/:id/fees`
- `POST /hospital/charges`
- `GET /hospital/charges/current`

---

## SECTION 9 — Environment Variables

The frontend needs only **one** environment variable:

```
VITE_API_URL=http://localhost:5000/api/v1
```

Create a `.env` file in your React project root:

```
VITE_API_URL=http://localhost:5000/api/v1
```

> **⚠️ Never put secrets in frontend env vars.** The API URL is fine. JWT secrets, database passwords — these stay on the backend only.

---

## SECTION 10 — Common Implementation Notes

### 1. Token Storage
Store `accessToken` in a React state variable, Zustand store, or React Context **only**. **Never** use `localStorage` or `sessionStorage`. Reason: XSS attacks can steal tokens from storage. In-memory tokens are lost on page refresh — the refresh cookie handles re-auth.

### 2. Auto Token Refresh
Use the Axios interceptor from Section 1.6. Never manually check token expiry in components. The interceptor catches `401` responses and silently refreshes.

### 3. Role-Based UI
Read the `role` from the decoded access token or from `GET /auth/me`. Hide menu items, buttons, and pages based on role. **Backend enforces access** — frontend hiding is UX only, not security.

### 4. hospital_id
**Never send** `hospital_id` in request bodies. The backend reads it from the JWT automatically. The frontend does not manage hospital scoping.

### 5. Pagination
All list endpoints support `?page=&limit=`. Default limit is 20, max is 100. Build a reusable `<Pagination />` component from day one.

### 6. Fee Display
Always display fees from the **appointment object** (the snapshot), **not** from doctor or hospital tables. A booked appointment's fee never changes, even if the doctor's fee changes later.

### 7. Session Status Colours (Suggested)

| Status | Colour | Hex |
|---|---|---|
| `scheduled` | Gray | `#9CA3AF` |
| `open` | Green | `#10B981` |
| `full` | Amber | `#F59E0B` |
| `closed` | Blue | `#3B82F6` |
| `cancelled` | Red | `#EF4444` |

### 8. Appointment Status Colours (Suggested)

| Status | Colour | Hex |
|---|---|---|
| `booked` | Blue | `#3B82F6` |
| `confirmed` | Teal | `#14B8A6` |
| `arrived` | Amber | `#F59E0B` |
| `completed` | Green | `#10B981` |
| `cancelled` | Red | `#EF4444` |
| `no_show` | Gray | `#6B7280` |

### 9. Date/Time Format
- All dates from backend: **ISO 8601** (`YYYY-MM-DD`)
- All times: **HH:MM** (24-hour format)
- All timestamps: **ISO 8601 UTC** (`2026-04-07T10:30:00.000Z`)
- Use `dayjs` or `date-fns` for display formatting

### 10. Error Handling Pattern
Every API call should handle these status codes:

| Code | Frontend Action |
|---|---|
| `400` | Show validation error message to user |
| `401` | Interceptor handles (refresh token or redirect to login) |
| `403` | Show "Not authorized" toast notification |
| `404` | Show "Not found" state in the UI |
| `409` | Show conflict message (e.g., "Patient already booked in this session") |
| `429` | Show "Too many attempts, please wait 15 minutes" |
| `500` | Show generic "Something went wrong" toast |

### 11. Queue Board Polling
`GET /sessions/:id/queue` should be polled every **30 seconds** on the queue board page:

```javascript
useEffect(() => {
  const fetchQueue = async () => {
    const res = await api.get(`/sessions/${sessionId}/queue`);
    setQueue(res.data.data);
  };

  fetchQueue(); // initial load
  const interval = setInterval(fetchQueue, 30000);
  return () => clearInterval(interval);
}, [sessionId]);
```

### 12. Form Defaults
- Session creation: `slot_duration` defaults to **10** minutes
- Session creation: `effective_from` defaults to **today**
- Queue display format: queue number `3` → `Q003` (zero-padded to 3 digits)

---

*End of API Documentation — v1.0*
