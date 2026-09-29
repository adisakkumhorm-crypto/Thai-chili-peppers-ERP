BEGIN;

ALTER TABLE public.purchase_requests
  DROP CONSTRAINT IF EXISTS purchase_requests_requested_by_fkey;

ALTER TABLE public.purchase_requests
  ADD CONSTRAINT purchase_requests_requested_by_fkey
  FOREIGN KEY (requested_by)
  REFERENCES auth.users(id)
  ON DELETE RESTRICT;

COMMIT;
