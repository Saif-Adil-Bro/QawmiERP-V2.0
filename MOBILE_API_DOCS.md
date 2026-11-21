# QawmiERP V2.0 — Mobile REST API Documentation (`MOBILE_API_DOCS.md`)

Complete REST API specification for native **Android (Kotlin + Jetpack Compose + Retrofit)** integration.

---

## 1. Base Configuration & Required Headers

- **Base URL**: `https://<your-domain>/api/mobile`
- **Media URLs**: All relative media/image/logo/avatar paths are automatically converted to full absolute URLs using `NEXT_PUBLIC_APP_URL` or the request host.

### Required Headers
| Header | Required For | Description |
| :--- | :--- | :--- |
| `x-api-key` | All `/api/mobile/*` endpoints (when `MOBILE_API_KEY` is set) | Secret API key configured in `.env.local` (`MOBILE_API_KEY`) |
| `Authorization` | All protected endpoints | `Bearer <access_token>` obtained from `/auth/login` |
| `Content-Type` | `POST`, `PATCH`, `PUT` | `application/json` (or `multipart/form-data` for `/upload`) |

---

## 2. Standardized JSON Envelope (Retrofit Data Classes)

Every endpoint returns a uniform envelope:

### Success Response
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "message": "Success"
}
```

### Error Response (`400`, `401`, `403`, `404`, `500`)
```json
{
  "success": false,
  "data": null,
  "message": "অবৈধ বা অনুপস্থিত API Key (x-api-key)।",
  "code": "INVALID_API_KEY"
}
```

---

## 3. Authentication Endpoints

### `POST /api/mobile/auth/login`
Supports **Email** OR **Student ID / Roll / Phone** login.
- **Request Body**:
```json
{
  "identifier": "admin@madrasa.com",
  "password": "your_password"
}
```
- **Sample Response (`200`)**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "v1.MR...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "expires_at": 1763160000,
    "user": {
      "id": "uuid",
      "email": "admin@madrasa.com",
      "full_name": "মাওলানা সাইফুল ইসলাম",
      "phone": "01711000000",
      "role": "super_admin",
      "roles": ["super_admin"],
      "permissions": ["*"],
      "madrasa_id": "uuid",
      "student_id_code": null,
      "is_default_password": false
    },
    "madrasa": {
      "id": "uuid",
      "name": "জামিয়াতুল উলুম মাদরাসা",
      "address": "ঢাকা, বাংলাদেশ",
      "contact_phone": "01711000000",
      "contact_email": "info@madrasa.com",
      "logo_url": "https://your-domain.com/uploads/logo.png"
    }
  },
  "message": "লগইন সফল হয়েছে।"
}
```

### `POST /api/mobile/auth/register`
- **Request Body**: `{ "madrasa_name": "...", "full_name": "...", "email": "...", "password": "...", "phone": "...", "address": "..." }`
- **Response (`201`)**: Same envelope with `access_token`, `refresh_token`, `user`, and `madrasa`.

### `POST /api/mobile/auth/refresh`
- **Request Body**: `{ "refresh_token": "..." }`
- **Response (`200`)**: `{ "success": true, "data": { "access_token": "...", "refresh_token": "...", "token_type": "Bearer", "expires_in": 3600, "expires_at": 1763160000 }, "message": "টোকেন রিফ্রেশ সফল হয়েছে।" }`

### `GET /api/mobile/auth/me`
- **Response (`200`)**: `{ "success": true, "data": { "user": { ... }, "madrasa": { ... } }, "message": "Authenticated" }`

### `POST /api/mobile/auth/logout`
- **Response (`200`)**: `{ "success": true, "data": { "logged_out": true }, "message": "লগআউট সম্পন্ন হয়েছে।" }`

---

## 4. Dashboard, Search, Notifications, Upload & Settings

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/mobile/dashboard` | Returns KPI stats (`students_count`, `teachers_count`, `classes_count`, `today_present`, `today_absent`, `today_income`, `today_expense`, `total_income`, `total_expense`, `net_balance`) and chart arrays (`monthly_income_expense`, `today_attendance`, `thirty_day_attendance`, `exam_pass_rate`). |
| `GET` | `/api/mobile/search?q=query` | Universal search across `students`, `teachers`, `classes`, `books`, `donors`. |
| `GET` | `/api/mobile/notifications?page=1&limit=20` | Paginated system notifications with `unread_count` in `meta`. |
| `PATCH` | `/api/mobile/notifications` | Body `{ "notification_id": "..." }` or `{ "mark_all": true }`. |
| `POST` | `/api/mobile/upload` | Multipart `file` or JSON `{ "imageBase64": "...", "filename": "..." }`. Returns `{ "url": "https://..." }`. |
| `GET` | `/api/mobile/settings` | Returns `madrasa` profile and `settings`. |
| `PATCH` | `/api/mobile/settings` | Updates `madrasa` fields and `settings` object. |

---

## 5. Dedicated Role Portals

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/mobile/portal/student?student_id=...` | Aggregated Student/Parent portal payload: `students`, `active_student`, `attendance`, `fees`, `exam_results`, `hifz_logs`, `kitab_logs`, `notices`. |
| `GET` | `/api/mobile/portal/teacher` | Aggregated Teacher portal payload: `teacher`, `assigned_subjects`, `routines`, `classes`, `notices`. |

---

## 6. Complete CRUD Entity Endpoints

All list endpoints support `?page=1&limit=20&search=...&sortBy=...&sortOrder=asc|desc` and return paginated `data: [...]` with `meta: { page, limit, total, totalPages }`.
All `[id]` endpoints support `GET`, `PATCH`, `PUT`, and `DELETE`.

### Academic, People & Attendance
| Entity | List & Create (`GET`, `POST`) | Detail, Update & Delete (`GET`, `PATCH`, `PUT`, `DELETE`) |
| :--- | :--- | :--- |
| Students | `/api/mobile/students` (filters: `class_id`, `status`, `gender`) | `/api/mobile/students/[id]` |
| Bulk Students | `POST /api/mobile/students/bulk` (`{ "students": [...] }`) | — |
| Teachers | `/api/mobile/teachers` (filter: `status`) | `/api/mobile/teachers/[id]` |
| Staff | `/api/mobile/staff` | `/api/mobile/staff/[id]` |
| Classes | `/api/mobile/classes` (filter: `department`) | `/api/mobile/classes/[id]` |
| Subjects | `/api/mobile/subjects` | `/api/mobile/subjects/[id]` |
| Class Subjects | `/api/mobile/class-subjects` | — |
| Teacher Subjects | `/api/mobile/teacher-subjects` | — |
| Academic Sessions | `/api/mobile/sessions` | `/api/mobile/sessions/[id]` |
| Student Enrollments | `/api/mobile/enrollments` | — |
| Routines | `/api/mobile/routines` (filters: `class_id`, `teacher_id`, `day_of_week`) | `/api/mobile/routines/[id]` |
| Attendance | `/api/mobile/attendance` (filters: `student_id`, `date`, `status`) | `/api/mobile/attendance/[id]` |
| Bulk Attendance | `POST /api/mobile/attendance/bulk` (`{ "date": "YYYY-MM-DD", "records": [...] }`) | — |
| Teacher Attendance | `/api/mobile/attendance/teachers` | — |
| Hifz Logs | `/api/mobile/hifz` (filters: `student_id`, `date`, `status`) | `/api/mobile/hifz/[id]` |
| Kitab Logs | `/api/mobile/kitab` (filters: `student_id`, `date`) | `/api/mobile/kitab/[id]` |
| Noorani Progress | `GET`, `POST /api/mobile/noorani` (`?student_id=...`) | — |
| Syllabus | `/api/mobile/syllabus` | `/api/mobile/syllabus/[id]` |
| Assignments | `/api/mobile/assignments` | `/api/mobile/assignments/[id]` |

### Exams, Admissions, Leaves & Certificates

`/exams` and `/exam-results` below are staff endpoints. Teacher and student/guardian apps read their scoped `/portal/teacher` or `/portal/student` snapshot instead. In the teacher snapshot, `exams[].is_locked` is the effective freeze flag (independent of publication). Display frozen marks as text, not entry fields. Staff result writes to a frozen exam return `409 EXAM_LOCKED`; a failed freeze check blocks the write (`503 EXAM_LOCK_UNAVAILABLE`). Use the privileged dashboard action for changing a freeze, not generic CRUD.

| Entity | List & Create (`GET`, `POST`) | Detail, Update & Delete (`GET`, `PATCH`, `PUT`, `DELETE`) |
| :--- | :--- | :--- |
| Exams | `/api/mobile/exams` | `/api/mobile/exams/[id]` |
| Exam Results | `/api/mobile/exam-results` (filters: `exam_id`, `student_id`, `subject_id`) | `/api/mobile/exam-results/[id]` |
| Exam Routines | `/api/mobile/exam-routines` | `/api/mobile/exam-routines/[id]` |
| Question Bank | `/api/mobile/questions` | `/api/mobile/questions/[id]` |
| Admissions | `/api/mobile/admissions` | `/api/mobile/admissions/[id]` |
| Alumni | `/api/mobile/alumni` | `/api/mobile/alumni/[id]` |
| Leaves | `/api/mobile/leaves` | `/api/mobile/leaves/[id]` |
| Holidays | `/api/mobile/holidays` | `/api/mobile/holidays/[id]` |
| Certificates | `/api/mobile/certificates` | — |
| ID Cards | `/api/mobile/id-cards` | — |

### Finance, Fees, Accounting, Zakat & Fundraising
| Entity | List & Create (`GET`, `POST`) | Detail, Update & Delete (`GET`, `PATCH`, `PUT`, `DELETE`) |
| :--- | :--- | :--- |
| Fees (Direct) | `/api/mobile/fees` | `/api/mobile/fees/[id]` |
| Fee Types | `/api/mobile/fee-types` | `/api/mobile/fee-types/[id]` |
| Fee Structures | `/api/mobile/fee-structures` | `/api/mobile/fee-structures/[id]` |
| Student Fees | `/api/mobile/student-fees` | `/api/mobile/student-fees/[id]` |
| Fee Payments | `/api/mobile/fee-payments` | `/api/mobile/fee-payments/[id]` |
| Fee Waivers | `/api/mobile/fee-waivers` | — |
| Expenses | `/api/mobile/expenses` | `/api/mobile/expenses/[id]` |
| Funds (Zakat/General) | `/api/mobile/funds` | `/api/mobile/funds/[id]` |
| Donors | `/api/mobile/donors` | `/api/mobile/donors/[id]` |
| Donations | `/api/mobile/donations` | `/api/mobile/donations/[id]` |
| Fundraising (Mahfils) | `/api/mobile/fundraising` | `/api/mobile/fundraising/[id]` |

### Operations, Boarding, Library, Inventory, Communication & Security
| Entity | List & Create (`GET`, `POST`) | Detail, Update & Delete (`GET`, `PATCH`, `PUT`, `DELETE`) |
| :--- | :--- | :--- |
| Boarding Meals | `/api/mobile/boarding/meals` | `/api/mobile/boarding/meals/[id]` |
| Boarding Bazar | `/api/mobile/boarding/bazar` | `/api/mobile/boarding/bazar/[id]` |
| Library Books | `/api/mobile/library/books` | `/api/mobile/library/books/[id]` |
| Book Issues | `/api/mobile/library/issues` | `/api/mobile/library/issues/[id]` |
| Inventory | `/api/mobile/inventory` | `/api/mobile/inventory/[id]` |
| Transport | `/api/mobile/transport` | `/api/mobile/transport/[id]` |
| Notices | `/api/mobile/notices` | `/api/mobile/notices/[id]` |
| SMS Logs | `/api/mobile/sms-logs` | — |
| Parent Communication | `/api/mobile/parent-communication` | `/api/mobile/parent-communication/[id]` |
| Tarbiyah Badges | `/api/mobile/tarbiyah/badges` | — |
| Amal Tracker | `/api/mobile/tarbiyah/amal-tracker` | — |
| Child Safety | `/api/mobile/child-safety` | — |
| Biometric Devices | `/api/mobile/biometric` | — |
| Users | `/api/mobile/users` | `/api/mobile/users/[id]` |
| Roles & Permissions | `/api/mobile/roles` | — |
| Security Audit Logs | `GET /api/mobile/audit-logs` | — |

---

## 7. Sample List & Detail JSON Responses

### `GET /api/mobile/students?page=1&limit=20&search=আব্দুল্লাহ`
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "madrasa_id": "550e8400-e29b-41d4-a716-446655440001",
      "full_name": "আব্দুল্লাহ আল মামুন",
      "roll_number": "101",
      "student_id_code": "AHH480101",
      "class_id": "class-uuid",
      "guardian_name": "মোঃ আব্দুর রহমান",
      "parent_phone": "01711000111",
      "photo_url": "https://your-domain.com/uploads/student_101.jpg",
      "classes": {
        "id": "class-uuid",
        "name": "জালালাইন"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "message": "Success"
}
```

### Student health (family portal)

`GET /api/mobile/portal/student?student_id=<linked UUID>` includes `health_records` (active cases + recoveries within 48 hours), most recent first within clinical priority, and `emergency_phone`. Each case includes `student_id`, `id`, `illness_type`, `severity`, `status`, `doctor_or_hospital`, `treatment_notes`, clinical `updated_at`, `guardian_acknowledged_at`, `recovered_at` and newest-first `timeline`. Unlinked selections have no health records. An empty successful array removes old alerts on sync; an incomplete or unsuccessful response does not replace the last good copy. Do not place this data in global device storage or push it to analytics.

`POST /api/mobile/portal/student` with the same active bearer session and API key, JSON `{"record_id":"<record UUID>","updated_at":"<clinical version read above>"}`, acknowledges a linked child's current update. `updated_at` is optional but recommended to avoid acknowledging an unseen follow-up. The endpoint does not accept a guardian phone, actor ID or tenant ID. Read-only offline views must not report a successful acknowledgment.
