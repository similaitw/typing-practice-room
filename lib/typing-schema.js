'use strict';

let schemaPromise = null;

async function ensureAssignmentSchema(sql) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS typing_students (
      id text PRIMARY KEY,
      student_class text NOT NULL DEFAULT '',
      student_seat text NOT NULL DEFAULT '',
      student_name text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS typing_students_identity_idx
      ON typing_students (student_class, student_seat, student_name)`;

    await sql`CREATE TABLE IF NOT EXISTS typing_assignments (
      id text PRIMARY KEY,
      title text NOT NULL,
      language text NOT NULL CHECK (language IN ('en','zh')),
      duration integer NOT NULL CHECK (duration IN (15,30,60,120)),
      min_accuracy integer NOT NULL DEFAULT 90 CHECK (min_accuracy BETWEEN 0 AND 100),
      min_speed integer NOT NULL DEFAULT 0 CHECK (min_speed BETWEEN 0 AND 10000),
      required_attempts integer NOT NULL DEFAULT 1 CHECK (required_attempts BETWEEN 1 AND 20),
      start_at timestamptz,
      due_at timestamptz,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS typing_assignment_targets (
      assignment_id text NOT NULL REFERENCES typing_assignments(id) ON DELETE CASCADE,
      student_class text NOT NULL,
      PRIMARY KEY (assignment_id, student_class)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS typing_assignment_targets_class_idx
      ON typing_assignment_targets (student_class, assignment_id)`;

    await sql`ALTER TABLE typing_records ADD COLUMN IF NOT EXISTS assignment_id text`;
    await sql`CREATE INDEX IF NOT EXISTS typing_records_assignment_student_idx
      ON typing_records (assignment_id, student_id, created_at DESC)`;

    await sql`CREATE TABLE IF NOT EXISTS typing_student_access (
      student_id text PRIMARY KEY REFERENCES typing_students(id) ON DELETE CASCADE,
      code_hash text,
      code_expires_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS typing_student_access_code_idx
      ON typing_student_access (code_hash) WHERE code_hash IS NOT NULL`;

    await sql`CREATE TABLE IF NOT EXISTS typing_student_sessions (
      id text PRIMARY KEY,
      student_id text NOT NULL REFERENCES typing_students(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS typing_student_sessions_student_idx
      ON typing_student_sessions (student_id, expires_at DESC)`;
  })().catch(error => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

module.exports = {ensureAssignmentSchema};
