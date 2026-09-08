create table if not exists public.typing_progress (
  student_id text not null,
  lesson_id text not null,
  language text not null check (language in ('en', 'zh')),
  completed_at timestamptz not null default now(),
  best_accuracy integer not null default 0 check (best_accuracy between 0 and 100),
  best_speed integer not null default 0 check (best_speed >= 0),
  attempts integer not null default 1 check (attempts >= 1),
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create index if not exists typing_progress_student_id_idx on public.typing_progress (student_id, updated_at desc);
create index if not exists typing_progress_language_idx on public.typing_progress (language, updated_at desc);
