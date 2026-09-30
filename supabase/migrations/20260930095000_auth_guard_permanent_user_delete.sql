BEGIN;

CREATE OR REPLACE FUNCTION private.auth_user_delete_is_safe(
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT NOT (
    -- Organization / HR relationships
    EXISTS (
      SELECT 1
      FROM public.memberships x
      WHERE x.user_id = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.employees x
      WHERE x.user_id = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.join_requests x
      WHERE x.user_id = target_user_id
    )

    -- Audit / business attribution
    OR EXISTS (
      SELECT 1
      FROM public.audit_log x
      WHERE x.actor_id = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.activities x
      WHERE x.owner = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.ai_outputs x
      WHERE x.created_by = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.clients x
      WHERE x.owner = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.deals x
      WHERE x.owner = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.inventory_transactions x
      WHERE x.created_by = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.journal_entries x
      WHERE x.created_by = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.leave_requests x
      WHERE x.approved_by = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_tasks x
      WHERE x.assignee = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects x
      WHERE x.owner = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.purchase_orders x
      WHERE x.approved_by = target_user_id
         OR x.requested_by = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.purchase_requests x
      WHERE x.requested_by = target_user_id
         OR x.approved_by = target_user_id
         OR x.po_created_by = target_user_id
         OR x.rejected_by = target_user_id
         OR x.revision_requested_by = target_user_id
         OR x.selected_by = target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.sales_orders x
      WHERE x.created_by = target_user_id
    )
  );
$function$;

REVOKE ALL ON FUNCTION private.auth_user_delete_is_safe(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION private.auth_user_delete_is_safe(uuid)
FROM anon;

REVOKE ALL ON FUNCTION private.auth_user_delete_is_safe(uuid)
FROM authenticated;


CREATE OR REPLACE FUNCTION private.guard_auth_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.auth_user_delete_is_safe(OLD.id) THEN
    RAISE EXCEPTION 'AUTH_USER_DELETE_BLOCKED_REFERENCES';
  END IF;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_auth_user_delete()
FROM PUBLIC;

REVOKE ALL ON FUNCTION private.guard_auth_user_delete()
FROM anon;

REVOKE ALL ON FUNCTION private.guard_auth_user_delete()
FROM authenticated;


DROP TRIGGER IF EXISTS guard_auth_user_delete
ON auth.users;

CREATE TRIGGER guard_auth_user_delete
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.guard_auth_user_delete();

COMMIT;
