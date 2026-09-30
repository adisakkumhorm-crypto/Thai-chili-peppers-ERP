BEGIN;

CREATE OR REPLACE FUNCTION public.assert_permanent_login_delete_allowed(
  p_target_user_id uuid,
  p_org_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
BEGIN
  ------------------------------------------------------------
  -- Authenticated actor required
  ------------------------------------------------------------

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  ------------------------------------------------------------
  -- Never allow deleting the currently signed-in account
  ------------------------------------------------------------

  IF v_actor_id = p_target_user_id THEN
    RAISE EXCEPTION 'SELF_DELETE_BLOCKED';
  END IF;

  ------------------------------------------------------------
  -- Actor must be OWNER of the organization that owns
  -- the removal tombstone.
  ------------------------------------------------------------

  SELECT m.role::text
  INTO v_actor_role
  FROM public.memberships AS m
  WHERE m.user_id = v_actor_id
    AND m.org_id = p_org_id;

  IF v_actor_role IS NULL OR v_actor_role <> 'owner' THEN
    RAISE EXCEPTION 'OWNER_REQUIRED';
  END IF;

  ------------------------------------------------------------
  -- Target must originate from this organization's
  -- Removed Login Candidate workflow.
  ------------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM public.audit_log AS a
    WHERE a.org_id = p_org_id
      AND a.entity = 'membership'
      AND a.entity_id = p_target_user_id
      AND a.action = 'REMOVE_MEMBER'
      AND a.meta->>'event_type' = 'removed_login_candidate'
  ) THEN
    RAISE EXCEPTION 'REMOVED_CANDIDATE_REQUIRED';
  END IF;

  ------------------------------------------------------------
  -- Auth account must still physically exist.
  ------------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND';
  END IF;

  ------------------------------------------------------------
  -- Global safety check.
  --
  -- This intentionally does NOT reveal which organization,
  -- employee, or business record is blocking deletion.
  ------------------------------------------------------------

  IF NOT private.auth_user_delete_is_safe(
    p_target_user_id
  ) THEN
    RAISE EXCEPTION 'AUTH_USER_STILL_REFERENCED';
  END IF;

END;
$function$;


REVOKE ALL ON FUNCTION public.assert_permanent_login_delete_allowed(
  uuid,
  uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.assert_permanent_login_delete_allowed(
  uuid,
  uuid
) FROM anon;

REVOKE ALL ON FUNCTION public.assert_permanent_login_delete_allowed(
  uuid,
  uuid
) FROM service_role;

GRANT EXECUTE ON FUNCTION public.assert_permanent_login_delete_allowed(
  uuid,
  uuid
) TO authenticated;

COMMIT;
