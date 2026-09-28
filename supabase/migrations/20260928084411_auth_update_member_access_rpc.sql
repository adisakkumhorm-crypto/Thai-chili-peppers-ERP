BEGIN;

CREATE OR REPLACE FUNCTION public.update_member_access(
  target_user_id uuid,
  org_id uuid,
  new_membership_role public.role_enum DEFAULT NULL,
  new_employee_role public.employee_role DEFAULT NULL,
  new_features jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text;
  target_current_role text;
  current_owner_count integer;
BEGIN

  -- Actor must belong to target organization
  SELECT m.role::text
  INTO actor_role
  FROM public.memberships AS m
  WHERE m.user_id = actor_id
    AND m.org_id = update_member_access.org_id;

  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'Actor not found in organization';
  END IF;

  IF actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Member cannot change organization permissions';
  END IF;

  -- Target must also belong to target organization
  SELECT m.role::text
  INTO target_current_role
  FROM public.memberships AS m
  WHERE m.user_id = update_member_access.target_user_id
    AND m.org_id = update_member_access.org_id;

  IF target_current_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found in organization';
  END IF;

  -- Feature permission must remain an array when supplied
  IF update_member_access.new_features IS NOT NULL
     AND jsonb_typeof(update_member_access.new_features) <> 'array' THEN
    RAISE EXCEPTION 'new_features must be a JSON array';
  END IF;

  -- Admin cannot modify existing owner at any access tier
  IF target_current_role = 'owner'
     AND actor_role <> 'owner' THEN
    RAISE EXCEPTION 'Admin cannot modify owner permissions';
  END IF;

  -- Only owner may grant owner
  IF update_member_access.new_membership_role = 'owner'
     AND actor_role <> 'owner' THEN
    RAISE EXCEPTION 'Only owner can grant owner role';
  END IF;

  -- Membership NULL = NO CHANGE
  IF update_member_access.new_membership_role IS NOT NULL THEN

    -- Only protect when target itself is currently an owner
    IF update_member_access.new_membership_role <> 'owner'
       AND target_current_role = 'owner' THEN

      SELECT COUNT(*)
      INTO current_owner_count
      FROM public.memberships AS m
      WHERE m.org_id = update_member_access.org_id
        AND m.role = 'owner';

      IF current_owner_count = 1 THEN
        RAISE EXCEPTION 'Cannot demote the last owner';
      END IF;
    END IF;

    UPDATE public.memberships
    SET role = update_member_access.new_membership_role
    WHERE user_id = update_member_access.target_user_id
      AND org_id = update_member_access.org_id;
  END IF;

  -- Employee role/features:
  -- NULL = NO CHANGE
  -- Never auto-create an employee record
  IF EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.user_id = update_member_access.target_user_id
      AND e.org_id = update_member_access.org_id
  ) THEN

    IF update_member_access.new_employee_role IS NOT NULL THEN
      UPDATE public.employees
      SET role = update_member_access.new_employee_role
      WHERE user_id = update_member_access.target_user_id
        AND org_id = update_member_access.org_id;
    END IF;

    IF update_member_access.new_features IS NOT NULL THEN
      UPDATE public.employees
      SET allowed_features = update_member_access.new_features
      WHERE user_id = update_member_access.target_user_id
        AND org_id = update_member_access.org_id;
    END IF;

  ELSE

    IF update_member_access.new_employee_role IS NOT NULL
       OR update_member_access.new_features IS NOT NULL THEN
      RAISE EXCEPTION
        'EMPLOYEE_RECORD_REQUIRED: No employee record exists for this user';
    END IF;

  END IF;

END;
$$;

REVOKE ALL ON FUNCTION public.update_member_access(
  uuid,
  uuid,
  public.role_enum,
  public.employee_role,
  jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.update_member_access(
  uuid,
  uuid,
  public.role_enum,
  public.employee_role,
  jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.update_member_access(
  uuid,
  uuid,
  public.role_enum,
  public.employee_role,
  jsonb
) TO authenticated;

COMMIT;
