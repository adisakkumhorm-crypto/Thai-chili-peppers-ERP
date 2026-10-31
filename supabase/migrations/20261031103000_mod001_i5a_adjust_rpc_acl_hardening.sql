-- MOD-001 I-5A
-- Harden rpc_adjust_stock execution privileges after production revealed that
-- PostgreSQL/Supabase default privileges for postgres-created functions in
-- schema public grant EXECUTE directly to anon.
--
-- The original I-5 migration already revoked PUBLIC, but PUBLIC revocation does
-- not remove a direct anon ACL entry inherited at CREATE FUNCTION time.
--
-- Keep the applied I-5 migration immutable. This additive migration removes
-- both PUBLIC and direct anon execution while preserving authenticated and
-- service-role execution.

REVOKE ALL
ON FUNCTION public.rpc_adjust_stock(
    UUID,
    UUID,
    UUID,
    INTEGER,
    NUMERIC,
    TEXT,
    TEXT,
    TEXT,
    UUID
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.rpc_adjust_stock(
    UUID,
    UUID,
    UUID,
    INTEGER,
    NUMERIC,
    TEXT,
    TEXT,
    TEXT,
    UUID
)
TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_adjust_stock(
    UUID,
    UUID,
    UUID,
    INTEGER,
    NUMERIC,
    TEXT,
    TEXT,
    TEXT,
    UUID
)
IS 'MOD-001 I-5/I-5A current-schema stock adjustment RPC; EXECUTE restricted to authenticated and service_role.';
