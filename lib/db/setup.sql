-- 1. Create Enums
CREATE TYPE "user_role" AS ENUM ('super_admin', 'admin', 'muhtamim', 'teacher', 'accountant', 'hostel_manager', 'library_manager', 'parent', 'student');

-- 2. Create Tables
CREATE TABLE "madrasas" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "registration_no" TEXT,
    "address" TEXT,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "subscription_plan" TEXT DEFAULT 'free',
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE "users" (
    "id" UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "madrasa_id" UUID REFERENCES madrasas(id) ON DELETE CASCADE NOT NULL,
    "role" "user_role" NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL UNIQUE,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. Enable Row Level Security
ALTER TABLE "madrasas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- 4. Create Custom Claims Function (optional, if you want JWT claims for madrasa_id)
-- Or we can just join against the users table for RLS.

-- Example RLS Policies using a lookup to the users table
-- We assume the user is authenticated if auth.uid() is not null.

-- Madrasas table policies:
-- Super Admins can see all. Regular users can only see their own madrasa.
CREATE POLICY "Users can view their own madrasa"
ON "madrasas"
FOR SELECT
TO authenticated
USING (
    id IN (SELECT madrasa_id FROM users WHERE id = auth.uid())
);

-- Users table policies:
-- Users can see all other users within their same madrasa.
CREATE POLICY "Users can view members of their madrasa"
ON "users"
FOR SELECT
TO authenticated
USING (
    madrasa_id IN (SELECT madrasa_id FROM users WHERE id = auth.uid())
);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON "users"
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Madrasa Admins can insert/update users in their madrasa
CREATE POLICY "Admins can manage users in their madrasa"
ON "users"
FOR ALL
TO authenticated
USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin' AND madrasa_id = users.madrasa_id)
);
