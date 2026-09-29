BEGIN;

CREATE OR REPLACE FUNCTION public.offboard_employee(
  target_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  target_org_id uuid;
  target_user_id uuid;
  actor_role text;
  target_membership_role text;
BEGIN
  SELECT e.org_id, e.user_id
  INTO target_org_id, target_user_id
  FROM public.employees AS e
  WHERE e.id = offboard_employee.target_employee_id
  FOR UPDATE;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  SELECT m.role::text
  INTO actor_role
  FROM public.memberships AS m
  WHERE m.user_id = actor_id
    AND m.org_id = target_org_id;

  IF actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to offboard employee';
  END IF;

  IF target_user_id IS NOT NULL THEN
    SELECT m.role::text
    INTO target_membership_role
    FROM public.memberships AS m
    WHERE m.user_id = target_user_id
      AND m.org_id = target_org_id;

    IF target_membership_role = 'owner' THEN
      RAISE EXCEPTION 'Owner cannot be offboarded from HR';
    END IF;
  END IF;

  UPDATE public.employees AS e
  SET is_active = false
  WHERE e.id = offboard_employee.target_employee_id
    AND e.org_id = target_org_id;

  IF target_user_id IS NOT NULL THEN
    DELETE FROM public.memberships AS m
    WHERE m.user_id = target_user_id
      AND m.org_id = target_org_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_employee_if_safe(
  target_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  target_org_id uuid;
  target_user_id uuid;
  actor_role text;
  history_count integer;
BEGIN
  SELECT e.org_id, e.user_id
  INTO target_org_id, target_user_id
  FROM public.employees AS e
  WHERE e.id = delete_employee_if_safe.target_employee_id
  FOR UPDATE;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  SELECT m.role::text
  INTO actor_role
  FROM public.memberships AS m
  WHERE m.user_id = actor_id
    AND m.org_id = target_org_id;

  IF actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to delete employee';
  END IF;

  IF target_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'EMPLOYEE_LINKED_USER: Unlink account before permanent delete';
  END IF;

  SELECT
      (SELECT COUNT(*) FROM public.leave_balances lb
       WHERE lb.employee_id = delete_employee_if_safe.target_employee_id)
    + (SELECT COUNT(*) FROM public.leave_requests lr
       WHERE lr.employee_id = delete_employee_if_safe.target_employee_id)
    + (SELECT COUNT(*) FROM public.timesheets ts
       WHERE ts.employee_id = delete_employee_if_safe.target_employee_id)
  INTO history_count;

  IF history_count <> 0 THEN
    RAISE EXCEPTION 'EMPLOYEE_HAS_HISTORY: Use inactive/offboard instead';
  END IF;

  DELETE FROM public.employees AS e
  WHERE e.id = delete_employee_if_safe.target_employee_id
    AND e.org_id = target_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.offboard_employee(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.offboard_employee(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.offboard_employee(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_employee_if_safe(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_employee_if_safe(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_employee_if_safe(uuid) TO authenticated;

COMMIT;
