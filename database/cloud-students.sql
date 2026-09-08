create table if not exists public.typing_students (
  id text primary key,
  student_class text not null default '',
  student_seat text not null default '',
  student_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists typing_students_identity_idx
  on public.typing_students (student_class, student_seat, student_name);

create index if not exists typing_students_active_class_idx
  on public.typing_students (active, student_class, student_seat, student_name);
