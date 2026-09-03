-- ========================================================================================
-- ERP Roadmap Phase 2 - Step 1: Role-Based Access Control
-- ========================================================================================

-- 1. สร้างประเภทสิทธิ์การใช้งาน (Role)
CREATE TYPE employee_role AS ENUM ('admin', 'foreman', 'staff');

-- 2. เพิ่มคอลัมน์ role และ user_id ลงในตาราง employees
ALTER TABLE employees 
ADD COLUMN role employee_role NOT NULL DEFAULT 'staff',
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. อัปเดตข้อมูลจำลองที่มีอยู่แล้วให้มี Role ตามตำแหน่ง
UPDATE employees 
SET role = 'foreman' 
WHERE position ILIKE '%foreman%' OR position ILIKE '%โฟร์แมน%';

UPDATE employees 
SET role = 'admin' 
WHERE position ILIKE '%admin%' OR position ILIKE '%ผู้จัดการ%';

-- 4. อัปเดต RLS Policy (ถ้าจำเป็นต้องใช้ user_id ในอนาคต)
-- ตอนนี้ให้ใช้ Policy เดิมไปก่อน แต่เตรียมโครงสร้างไว้สำหรับการจำกัดสิทธิ์หน้าเว็บ
