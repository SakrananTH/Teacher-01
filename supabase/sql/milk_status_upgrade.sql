-- อัปเดตตาราง milk_records เพื่อรองรับสถานะการดื่มนมหลายแบบ (ดื่ม, ไม่ดื่ม, ขาดเรียน)

-- 1. เพิ่มคอลัมน์ status
ALTER TABLE public.milk_records 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'none';

-- 2. อัปเดตข้อมูลเก่าให้ตรงกับระบบใหม่
UPDATE public.milk_records 
SET status = 'drank' 
WHERE is_drunk = true;

UPDATE public.milk_records 
SET status = 'not_drank' 
WHERE is_drunk = false AND status = 'none';

-- (ทางเลือก) สามารถเก็บคอลัมน์ is_drunk ไว้เพื่อความเข้ากันได้กับโค้ดเก่า หรือถ้าแน่ใจแล้วสามารถลบออกได้
-- ALTER TABLE public.milk_records DROP COLUMN is_drunk;
