BEGIN;

CREATE OR REPLACE FUNCTION public.remove_member_with_tombstone(
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
  v_target_role text;
  v_actor_email text;
  v_target_email text;
  v_owner_count integer;
  v_deleted_count integer;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT m.role::text
  INTO v_actor_role
  FROM public.memberships AS m
  WHERE m.user_id = v_actor_id
    AND m.org_id = p_org_id;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'ACTOR_NOT_IN_ORGANIZATION';
  END IF;

  IF v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSION';
  END IF;

  IF v_actor_id = p_target_user_id THEN
    RAISE EXCEPTION 'SELF_REMOVE_BLOCKED';
  END IF;

  SELECT m.role::text
  INTO v_target_role
  FROM public.memberships AS m
  WHERE m.user_id = p_target_user_id
    AND m.org_id = p_org_id
  FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'TARGET_NOT_IN_ORGANIZATION';
  END IF;

  IF v_target_role = 'owner'
     AND v_actor_role <> 'owner' THEN
    RAISE EXCEPTION 'ADMIN_CANNOT_REMOVE_OWNER';
  END IF;

  IF v_target_role = 'owner' THEN
    SELECT COUNT(*)
    INTO v_owner_count
    FROM public.memberships AS m
    WHERE m.org_id = p_org_id
      AND m.role = 'owner';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'CANNOT_REMOVE_LAST_OWNER';
    END IF;
  END IF;

  SELECT u.email
  INTO v_actor_email
  FROM auth.users AS u
  WHERE u.id = v_actor_id;

  SELECT u.email
  INTO v_target_email
  FROM auth.users AS u
  WHERE u.id = p_target_user_id;

  /*
   * Tombstone is created in the SAME database transaction as
   * membership removal. If this INSERT fails, nothing below commits.
   */
  INSERT INTO public.audit_log (
    org_id,
    actor_id,
    actor_email,
    entity,
    entity_id,
    action,
    summary,
    meta
  )
  VALUES (
    p_org_id,
    v_actor_id,
    v_actor_email,
    'membership',
    p_target_user_id,
    'REMOVE_MEMBER',
    'Removed login access from organization',
    jsonb_build_object(
      'event_type', 'removed_login_candidate',
      'target_user_id', p_target_user_id,
      'target_email', v_target_email,
      'target_role', v_target_role
    )
  );

  /*
   * A future join must start fresh.
   * This delete is part of the same atomic transaction.
   */
  DELETE FROM public.join_requests AS j
  WHERE j.user_id = p_target_user_id
    AND j.org_id = p_org_id;

  DELETE FROM public.memberships AS m
  WHERE m.user_id = p_target_user_id
    AND m.org_id = p_org_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count <> 1 THEN
    RAISE EXCEPTION 'MEMBERSHIP_DELETE_COUNT_INVALID: %',
      v_deleted_count;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_member_with_tombstone(
  uuid,
  uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.remove_member_with_tombstone(
  uuid,
  uuid
) FROM anon;

GRANT EXECUTE ON FUNCTION public.remove_member_with_tombstone(
  uuid,
  uuid
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.remove_member_with_tombstone(
  uuid,
  uuid
) TO service_role;

COMMIT;
