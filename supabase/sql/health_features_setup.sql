begin;

create table if not exists public.milk_records (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null,
  is_drunk boolean not null default false,
  note text,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milk_owner_student_date_unique unique (owner_user_id, student_id, record_date)
);

create table if not exists public.health_measurements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  record_date date not null,
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  note text,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index milk_records_owner_date_idx on public.milk_records(owner_user_id, record_date);
create index health_measurements_owner_idx on public.health_measurements(owner_user_id, student_id);

create trigger milk_records_set_updated_at
before update on public.milk_records
for each row execute function public.set_updated_at();

create trigger health_measurements_set_updated_at
before update on public.health_measurements
for each row execute function public.set_updated_at();

alter table public.milk_records enable row level security;
alter table public.health_measurements enable row level security;

create policy milk_records_owner_policy
on public.milk_records
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy health_measurements_owner_policy
on public.health_measurements
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

commit;
