# Supabase Deploy Checklist

## 1. Run the clean SQL setup

Run the SQL in [teacher_dashboard_clean_setup.sql](c:/Users/User/OneDrive%20-%20University%20of%20Phayao/Desktop/Teacher%20Dashboard/supabase/sql/teacher_dashboard_clean_setup.sql) inside the Supabase SQL Editor first.

## 2. Use CLI via npx

```powershell
npx supabase --version
```

Verify:

```powershell
npx supabase --version
```

## 3. Authenticate and link project

```powershell
npx supabase login
npx supabase link --project-ref kokkbdyqrfmkdwfmvfub
```

## 4. Deploy the edge function

Run from the workspace root:

```powershell
npx supabase functions deploy make-server-80ad9986
```

## 5. Validate after deploy

Check these flows in the app:

1. `students` page matches the `students` table.
2. `attendance` page reads and saves rows in `attendance_records`.
3. `savings` page reads balances from `savings_accounts`.
4. Transaction history reads rows from `savings_transactions`.

## 6. Recommended verification queries

```sql
select id, student_no, full_name from public.students order by student_no;
select student_id, attendance_date, status from public.attendance_records order by attendance_date desc, student_id;
select student_id, current_balance from public.savings_accounts order by student_id;
select student_id, transaction_type, amount, transaction_at from public.savings_transactions order by transaction_at desc;
```

## 7. Teacher login validation

1. Sign up a teacher account from the app.
2. Confirm a row exists in `teacher_profiles` for that teacher.
3. Log in and verify new students are stored with `owner_user_id = auth.uid()`.