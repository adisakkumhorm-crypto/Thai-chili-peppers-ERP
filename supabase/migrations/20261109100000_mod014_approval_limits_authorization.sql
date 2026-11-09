-- MOD-014
-- Harden approval_limits mutation authorization.
--
-- Security boundary:
--   SELECT:
--     authenticated members of the organization
--
--   INSERT / UPDATE / DELETE:
--     authenticated owner/admin of the organization only
--
-- Rationale:
--   approval_limits is authoritative input to the purchasing approval
--   boundary. An ordinary organization member must not be able to grant
--   or increase their own approval authority.
--
-- Scope:
--   * RLS policy hardening only
--   * existing user-specific approval-limit semantics preserved
--   * role_name semantics intentionally unchanged
--   * no application behavior change intended

BEGIN;

ALTER TABLE public.approval_limits
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_limits_rw
  ON public.approval_limits;

DROP POLICY IF EXISTS approval_limits_select
  ON public.approval_limits;

DROP POLICY IF EXISTS approval_limits_insert_admin
  ON public.approval_limits;

DROP POLICY IF EXISTS approval_limits_update_admin
  ON public.approval_limits;

DROP POLICY IF EXISTS approval_limits_delete_admin
  ON public.approval_limits;

CREATE POLICY approval_limits_select
ON public.approval_limits
FOR SELECT
TO authenticated
USING (
  private.is_org_member(org_id)
);

CREATE POLICY approval_limits_insert_admin
ON public.approval_limits
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = approval_limits.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);

CREATE POLICY approval_limits_update_admin
ON public.approval_limits
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = approval_limits.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = approval_limits.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);

CREATE POLICY approval_limits_delete_admin
ON public.approval_limits
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = approval_limits.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);

COMMIT;
