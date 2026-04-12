begin;

create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.savings_transactions cascade;
drop table if exists public.savings_accounts cascade;
drop table if exists public.attendance_records cascade;
drop table if exists public.students cascade;
drop table if exists public.classrooms cascade;
drop table if exists public.teacher_profiles cascade;
drop table if exists public.kv_store_80ad9986 cascade;

drop type if exists public.savings_transaction_type cascade;
drop type if exists public.attendance_status cascade;

drop function if exists public.handle_new_teacher_profile() cascade;
drop function if exists public.recalculate_savings_account_balance() cascade;
drop function if exists public.validate_savings_transaction() cascade;
drop function if exists public.set_updated_at() cascade;

create type public.attendance_status as enum ('present', 'late', 'leave', 'absent');
create type public.savings_transaction_type as enum ('deposit', 'withdraw');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_teacher_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.teacher_profiles (user_id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'คุณครู'),
    'teacher'
  )
  on conflict (user_id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.validate_savings_transaction()
returns trigger
language plpgsql
as $$
declare
  current_balance numeric(12,2);
  current_effect numeric(12,2);
  next_effect numeric(12,2);
begin
  select coalesce(sum(
    case
      when transaction_type = 'deposit' then amount
      else -amount
    end
  ), 0)
  into current_balance
  from public.savings_transactions
  where account_id = new.account_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if tg_op = 'UPDATE' then
    current_effect := case when old.transaction_type = 'deposit' then old.amount else -old.amount end;
  else
    current_effect := 0;
  end if;

  next_effect := case when new.transaction_type = 'deposit' then new.amount else -new.amount end;

  if current_balance + current_effect + next_effect < 0 then
    raise exception 'Insufficient balance';
  end if;

  return new;
end;
$$;

create or replace function public.recalculate_savings_account_balance()
returns trigger
language plpgsql
as $$
declare
  target_account_id uuid;
begin
  target_account_id := coalesce(new.account_id, old.account_id);

  update public.savings_accounts
  set current_balance = coalesce((
    select sum(
      case
        when transaction_type = 'deposit' then amount
        else -amount
      end
    )
    from public.savings_transactions
    where account_id = target_account_id
  ), 0),
  updated_at = now()
  where id = target_account_id;

  return coalesce(new, old);
end;
$$;

create table public.teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  level text,
  section text,
  academic_year integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classrooms_owner_name_unique unique (owner_user_id, name)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  student_no integer not null check (student_no > 0),
  full_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'graduated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_owner_student_no_unique unique (owner_user_id, classroom_id, student_no)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  status public.attendance_status not null,
  note text,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_owner_student_date_unique unique (owner_user_id, student_id, attendance_date)
);

create table public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null unique references public.students(id) on delete cascade,
  current_balance numeric(12,2) not null default 0 check (current_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.savings_accounts(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  transaction_type public.savings_transaction_type not null,
  amount numeric(12,2) not null check (amount > 0),
  transaction_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index students_owner_idx on public.students(owner_user_id, student_no);
create index classrooms_owner_idx on public.classrooms(owner_user_id, name);
create index attendance_owner_date_idx on public.attendance_records(owner_user_id, attendance_date);
create index savings_accounts_owner_idx on public.savings_accounts(owner_user_id, student_id);
create index savings_transactions_owner_idx on public.savings_transactions(owner_user_id, transaction_at desc);

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_teacher_profile();

insert into public.teacher_profiles (user_id, email, display_name, role)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data->>'name', split_part(users.email, '@', 1), 'คุณครู'),
  'teacher'
from auth.users as users
on conflict (user_id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  updated_at = now();

create trigger teacher_profiles_set_updated_at
before update on public.teacher_profiles
for each row execute function public.set_updated_at();

create trigger classrooms_set_updated_at
before update on public.classrooms
for each row execute function public.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

create trigger savings_accounts_set_updated_at
before update on public.savings_accounts
for each row execute function public.set_updated_at();

create trigger savings_transactions_validate_balance
before insert or update on public.savings_transactions
for each row execute function public.validate_savings_transaction();

create trigger savings_transactions_sync_balance
after insert or update or delete on public.savings_transactions
for each row execute function public.recalculate_savings_account_balance();

alter table public.teacher_profiles enable row level security;
alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.attendance_records enable row level security;
alter table public.savings_accounts enable row level security;
alter table public.savings_transactions enable row level security;

create policy teacher_profiles_self_policy
on public.teacher_profiles
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy classrooms_owner_policy
on public.classrooms
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy students_owner_policy
on public.students
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy attendance_owner_policy
on public.attendance_records
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy savings_accounts_owner_policy
on public.savings_accounts
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy savings_transactions_owner_policy
on public.savings_transactions
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

commit;