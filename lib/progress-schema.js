'use strict';

let schemaPromise = null;

async function createSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS typing_progress (
    student_id text NOT NULL,
    lesson_id text NOT NULL,
    language text NOT NULL CHECK (language IN ('en','zh')),
    completed_at timestamptz NOT NULL DEFAULT now(),
    best_accuracy integer NOT NULL DEFAULT 0 CHECK (best_accuracy BETWEEN 0 AND 100),
    best_speed integer NOT NULL DEFAULT 0 CHECK (best_speed >= 0),
    attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, lesson_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS typing_progress_student_id_idx ON typing_progress (student_id, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS typing_progress_language_idx ON typing_progress (language, updated_at DESC)`;
}

async function ensureProgressSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = createSchema(sql).catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

module.exports = {ensureProgressSchema};
