-- Stores only salted password hashes. The original environment password is used
-- only until the teacher sets a password for the first time.
CREATE TABLE IF NOT EXISTS public.teacher_credentials (
  id integer PRIMARY KEY CHECK (id = 1),
  password_hash text NOT NULL,
  revision text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
