BEGIN;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS allowed_features JSONB
DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_user_org_uniq'
      AND conrelid = 'public.employees'::regclass
  ) THEN
    ALTER TABLE public.employees
    ADD CONSTRAINT employees_user_org_uniq
    UNIQUE (user_id, org_id);
  END IF;
END
$$;

COMMIT;
