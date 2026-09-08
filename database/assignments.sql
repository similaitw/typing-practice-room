create table if not exists public.typing_assignments (
  id text primary key,
  title text not null,
  language text not null check (language in ('en','zh')),
  duration integer not null check (duration in (15,30,60,120)),
  min_accuracy integer not null default 90 check (min_accuracy between 0 and 100),
  min_speed integer not null default 0 check (min_speed between 0 and 10000),
  required_attempts integer not null default 1 check (required_attempts between 1 and 20),
  start_at timestamptz,
  due_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.typing_assignment_targets (
  assignment_id text not null references public.typing_assignments(id) on delete cascade,
  student_class text not null,
  primary key (assignment_id, student_class)
);

create index if not exists typing_assignment_targets_class_idx
  on public.typing_assignment_targets (student_class, assignment_id);

alter table public.typing_records add column if not exists assignment_id text;
create index if not exists typing_records_assignment_student_idx
  on public.typing_records (assignment_id, student_id, created_at desc);

create table if not exists public.typing_student_access (
  student_id text primary key references public.typing_students(id) on delete cascade,
  code_hash text,
  code_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists typing_student_access_code_idx
  on public.typing_student_access (code_hash) where code_hash is not null;

create table if not exists public.typing_student_sessions (
  id text primary key,
  student_id text not null references public.typing_students(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists typing_student_sessions_student_idx
  on public.typing_student_sessions (student_id, expires_at desc);
