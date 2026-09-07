create table if not exists public.typing_records (
  id text primary key,
  student_id text,
  student_label text not null,
  student_class text not null default '',
  student_name text not null default '',
  student_seat text not null default '',
  language text not null check (language in ('en', 'zh')),
  source text not null check (source in ('builtin', 'custom')),
  duration integer not null check (duration in (15, 30, 60, 120)),
  elapsed_seconds numeric(10, 3) not null check (elapsed_seconds > 0 and elapsed_seconds <= duration + 1),
  speed integer not null check (speed >= 0),
  unit text not null check (unit in ('WPM', 'CPM')),
  accuracy integer not null check (accuracy between 0 and 100),
  correct_chars integer not null check (correct_chars >= 0),
  errors integer not null check (errors >= 0),
  typed_length integer not null check (typed_length > 0),
  target_length integer not null check (target_length > 0),
  created_at timestamptz not null
);

create index if not exists typing_records_created_at_idx on public.typing_records (created_at desc);
create index if not exists typing_records_student_id_idx on public.typing_records (student_id);
create index if not exists typing_records_language_duration_idx on public.typing_records (language, duration);
