-- สร้างตารางเก็บข้อมูลการบ้าน (Assignments)
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null,
  description text,
  due_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- สร้างตารางเก็บข้อมูลการส่งการบ้าน (Assignment Submissions)
create type public.submission_status as enum ('pending', 'submitted', 'missing');

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.submission_status not null default 'pending',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_submissions_assignment_student_unique unique (assignment_id, student_id)
);

-- Trigger สำหรับอัปเดต updated_at เมื่อมีการแก้ไขข้อมูล
create trigger set_assignments_updated_at
  before update on public.assignments
  for each row
  execute function public.set_updated_at();

create trigger set_assignment_submissions_updated_at
  before update on public.assignment_submissions
  for each row
  execute function public.set_updated_at();

-- ตั้งค่า Row Level Security (RLS)
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

-- นโยบาย RLS สำหรับระบุว่าผู้ใช้จะจัดการได้เฉพาะข้อมูลของตัวเอง
create policy "Users can view their own assignments"
  on public.assignments for select
  using (owner_user_id = auth.uid());

create policy "Users can insert their own assignments"
  on public.assignments for insert
  with check (owner_user_id = auth.uid());

create policy "Users can update their own assignments"
  on public.assignments for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "Users can delete their own assignments"
  on public.assignments for delete
  using (owner_user_id = auth.uid());

-- นโยบาย RLS สำหรับระบุว่าผู้ใช้จะจัดการได้เฉพาะข้อมูลการส่งงานของการบ้านของตนเอง
create policy "Users can view their student submissions"
  on public.assignment_submissions for select
  using (
    assignment_id in (
      select id from public.assignments where owner_user_id = auth.uid()
    )
  );

create policy "Users can insert their student submissions"
  on public.assignment_submissions for insert
  with check (
    assignment_id in (
      select id from public.assignments where owner_user_id = auth.uid()
    )
  );

create policy "Users can update their student submissions"
  on public.assignment_submissions for update
  using (
    assignment_id in (
      select id from public.assignments where owner_user_id = auth.uid()
    )
  );

create policy "Users can delete their student submissions"
  on public.assignment_submissions for delete
  using (
    assignment_id in (
      select id from public.assignments where owner_user_id = auth.uid()
    )
  );

-- สร้าง Realtime features ให้ตาราง
alter publication supabase_realtime add table public.assignments;
alter publication supabase_realtime add table public.assignment_submissions;
