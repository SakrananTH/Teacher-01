begin;

create table if not exists public.toothbrush_records (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null,
  status text not null default 'none',
  note text,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint toothbrush_owner_student_date_unique unique (owner_user_id, student_id, record_date)
);

create index toothbrush_records_owner_date_idx on public.toothbrush_records(owner_user_id, record_date);

create trigger toothbrush_records_set_updated_at
before update on public.toothbrush_records
for each row execute function public.set_updated_at();

alter table public.toothbrush_records enable row level security;

create policy toothbrush_records_owner_policy
on public.toothbrush_records
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

commit;
