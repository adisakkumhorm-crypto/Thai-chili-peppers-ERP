-- MOD-001 I-11
-- Direct stock RPC security hardening.
--
-- Scope:
--   * rpc_receive_stock_direct
--   * rpc_issue_stock
--   * rpc_transfer_stock
--
-- This migration intentionally changes FUNCTION METADATA / ACL ONLY.
-- It must not replace or rewrite any existing function body.

ALTER FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  SECURITY INVOKER;

ALTER FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  OWNER TO postgres;

ALTER FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  SET search_path = public, pg_temp;

REVOKE ALL
ON FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
TO service_role;


ALTER FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  SECURITY INVOKER;

ALTER FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  OWNER TO postgres;

ALTER FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  SET search_path = public, pg_temp;

REVOKE ALL
ON FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
TO service_role;


ALTER FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
  SECURITY INVOKER;

ALTER FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
  OWNER TO postgres;

ALTER FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
  SET search_path = public, pg_temp;

REVOKE ALL
ON FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
TO service_role;

COMMENT ON FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
IS 'MOD-001 I-11 hardened direct stock receipt RPC metadata and execution ACL; function body unchanged.';

COMMENT ON FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
IS 'MOD-001 I-11 hardened stock issue RPC metadata and execution ACL; function body unchanged.';

COMMENT ON FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
IS 'MOD-001 I-11 hardened stock transfer RPC metadata and execution ACL; function body unchanged.';
