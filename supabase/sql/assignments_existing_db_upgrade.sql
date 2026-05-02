-- ใช้ไฟล์นี้เมื่อมีตาราง assignments และ assignment_submissions อยู่แล้ว
-- สำหรับอัปเกรดฐานข้อมูลเดิมให้รองรับฟีเจอร์ใหม่ของหน้าตรวจการบ้าน

alter table public.assignments
  add column if not exists description text,
  add column if not exists due_date date not null default current_date,
  add column if not exists attachment_url text,
  add column if not exists max_score integer;

do $$
begin
  alter table public.assignments
    add constraint assignments_max_score_check check (max_score is null or max_score >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'submission_status'
  ) then
    create type public.submission_status as enum ('pending', 'submitted', 'missing', 'late', 'needs_revision', 'reviewed', 'excused');
  end if;
end $$;

do $$
begin
  alter type public.submission_status add value 'late';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.submission_status add value 'needs_revision';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.submission_status add value 'reviewed';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.submission_status add value 'excused';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignment_submissions'
      and column_name = 'status'
      and udt_name <> 'submission_status'
  ) then
    alter table public.assignment_submissions
      alter column status drop default;

    alter table public.assignment_submissions
      alter column status type public.submission_status
      using (
        case
          when status in ('pending', 'submitted', 'missing', 'late', 'needs_revision', 'reviewed', 'excused') then status::public.submission_status
          else 'pending'::public.submission_status
        end
      );

    alter table public.assignment_submissions
      alter column status set default 'pending'::public.submission_status;
  end if;
end $$;

alter table public.assignment_submissions
  add column if not exists teacher_note text,
  add column if not exists score numeric(6,2),
  add column if not exists reviewed_at timestamptz;

do $$
begin
  alter table public.assignment_submissions
    add constraint assignment_submissions_score_check check (score is null or score >= 0);
exception
  when duplicate_object then null;
end $$;