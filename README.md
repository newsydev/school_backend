# School Admissions Backend

This small Express backend accepts the admission application form (multipart/form-data), uploads provided files to Supabase Storage and inserts a record into a Supabase `admission_applications` table.

Prereqs
 - Node 18+ / npm
 - A Supabase project with a table named `admission_applications` and a Storage bucket (see SQL below)

Setup
1. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_KEY` (service role key recommended for server use) and `SUPABASE_BUCKET`.
2. Install dependencies:

```powershell
cd backend
npm install
```

3. Run the server in dev:

```powershell
npm run dev
```

Endpoints
- `POST /api/v1/admissions` — Accepts the admission form and optional files (`photo`, `previous_marksheet`, `address_proof`). Returns the created record.
- `GET /api/v1/admissions/track?application_id=...&otp=...` — Lookup by application id + otp.

Admin endpoints
- `POST /api/v1/auth/login` — body `{ email, password }` returns `{ token }` (JWT).
- `GET /api/v1/admin/admissions` — protected; list admissions with optional query params `status`, `class_applied`, `q`, `limit`.
- `GET /api/v1/admin/admissions/:id` — protected; get by `id` or `application_id`.
- `PUT /api/v1/admin/admissions/:id/review` — protected; body `{ status, documentChecks, remarks }` updates record.

Supabase table schema (example)

Run this SQL in Supabase SQL editor to create the `admission_applications` table used by the backend:

```sql
create table public.admission_applications (
  id uuid default uuid_generate_v4() primary key,
  application_id text unique,
  student_name text,
  dob date,
  gender text,
  class_applied int,
  previous_school text,
  address text,
  father_name text,
  mother_name text,
  father_mobile text,
  mother_mobile text,
  email text,
  aadhaar text,
  category text,
  otp_for_tracking text,
  photo_url text,
  previous_marksheet_url text,
  address_proof_url text,
  created_at timestamptz default now()
);
```

Notes
- For uploads the server uses the supplied `SUPABASE_KEY` to upload file buffers. Keep that key secret — use server environment variables and do not embed it in client code.
 - Admin credentials and JWT secret can be set in `.env`:
   - `ADMIN_EMAIL`, `ADMIN_PASS`, `JWT_SECRET`.
# Schoolpage Backend (mock)

This is a small mock Express backend implementing the admissions API.

Quick start

1. Change into the backend folder:

```powershell
cd backend
npm install
npm run dev
```

2. The server runs at `http://localhost:4000` by default.

Endpoints (summary)
- POST `/api/v1/admissions` — submit admission (multipart/form-data). Returns `{ applicationId, trackingToken }`.
- GET `/api/v1/admissions/track?applicationId=...&otp=...` — track application (limited info).
- POST `/api/v1/admissions/otp/request` — regenerate/send OTP (mock).
- POST `/api/v1/auth/login` — admin login (default admin: `admin@school.local` / `password`) returns `{ token }`.
- Protected admin routes under `/api/v1/admin/*` require `Authorization: Bearer <token>`.
- POST `/api/v1/payments/initiate` — mock payment initiation.
- POST `/api/v1/payments/webhook` — mock webhook to update payment status.

Data storage
- Uses JSON files in `backend/data/` and stores uploads in `backend/uploads/`.

Notes
- This is a toy implementation for local testing only. Do not use in production.
