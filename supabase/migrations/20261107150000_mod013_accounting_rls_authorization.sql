-- MOD-013
-- Harden accounting direct-table mutation authorization.
--
-- Application boundary:
--   SELECT: any member of the organization
--   INSERT/UPDATE/DELETE: owner or admin only
--
-- This replaces the legacy ALL policies that allowed every organization
-- member to mutate accounting connection/synchronization state.

ALTER TABLE public.accounting_connections
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounting_connections
  FORCE ROW LEVEL SECURITY;

ALTER TABLE public.accounting_sync_map
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounting_sync_map
  FORCE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- accounting_connections
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS accounting_connections_rw
  ON public.accounting_connections;

DROP POLICY IF EXISTS accounting_connections_select
  ON public.accounting_connections;

DROP POLICY IF EXISTS accounting_connections_insert_admin
  ON public.accounting_connections;

DROP POLICY IF EXISTS accounting_connections_update_admin
  ON public.accounting_connections;

DROP POLICY IF EXISTS accounting_connections_delete_admin
  ON public.accounting_connections;


CREATE POLICY accounting_connections_select
ON public.accounting_connections
FOR SELECT
TO authenticated
USING (
  private.is_org_member(org_id)
);


CREATE POLICY accounting_connections_insert_admin
ON public.accounting_connections
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = accounting_connections.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);


CREATE POLICY accounting_connections_update_admin
ON public.accounting_connections
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = accounting_connections.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = accounting_connections.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);


CREATE POLICY accounting_connections_delete_admin
ON public.accounting_connections
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = accounting_connections.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);


-- ---------------------------------------------------------------------------
-- accounting_sync_map
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS accounting_sync_map_rw
  ON public.accounting_sync_map;

DROP POLICY IF EXISTS accounting_sync_map_select
  ON public.accounting_sync_map;

DROP POLICY IF EXISTS accounting_sync_map_insert_admin
  ON public.accounting_sync_map;

DROP POLICY IF EXISTS accounting_sync_map_update_admin
  ON public.accounting_sync_map;

DROP POLICY IF EXISTS accounting_sync_map_delete_admin
  ON public.accounting_sync_map;


CREATE POLICY accounting_sync_map_select
ON public.accounting_sync_map
FOR SELECT
TO authenticated
USING (
  private.is_org_member(org_id)
);


CREATE POLICY accounting_sync_map_insert_admin
ON public.accounting_sync_map
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = accounting_sync_map.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);


CREATE POLICY accounting_sync_map_update_admin
ON public.accounting_sync_map
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = accounting_sync_map.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = accounting_sync_map.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);


CREATE POLICY accounting_sync_map_delete_admin
ON public.accounting_sync_map
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = accounting_sync_map.org_id
      AND m.user_id = auth.uid()
      AND m.role::text IN ('owner', 'admin')
  )
);
