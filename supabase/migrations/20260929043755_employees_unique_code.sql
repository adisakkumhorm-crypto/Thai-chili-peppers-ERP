BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_org_employee_code_uniq'
      AND conrelid = 'public.employees'::regclass
  ) THEN
    ALTER TABLE public.employees
    ADD CONSTRAINT employees_org_employee_code_uniq
    UNIQUE (org_id, employee_code);
  END IF;
END
$$;

COMMIT;
