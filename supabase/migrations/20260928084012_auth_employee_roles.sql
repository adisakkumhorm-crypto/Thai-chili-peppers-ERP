ALTER TYPE public.employee_role
ADD VALUE IF NOT EXISTS 'manager';

ALTER TYPE public.employee_role
ADD VALUE IF NOT EXISTS 'executive';
