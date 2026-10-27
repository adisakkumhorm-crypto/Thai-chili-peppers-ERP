/*
 * MOD-001 I-1D.3
 *
 * Access / grant ceiling.
 *
 * Security contract:
 *
 *   OWNER
 *     - may manage all recognized membership roles
 *     - may manage all recognized employee roles
 *     - may manage explicit feature grants
 *
 *   MEMBERSHIP ADMIN
 *     - may manage membership MEMBER targets only
 *     - may not create or manage membership OWNER / ADMIN authority
 *     - may assign staff / foreman / manager / executive
 *     - may not create or manage employee ADMIN authority
 *     - may manage explicit allowed_features for ordinary members
 *
 *   EXECUTIVE
 *     - remains a business role
 *     - is not universal authority
 *     - gains features only through explicit feature access
 *
 * Enforcement layers:
 *
 *   1. public.update_member_access()
 *      SECURITY DEFINER RPC ceiling.
 *
 *   2. public.employees RLS
 *      Direct authenticated table-write ceiling.
 *
 *   3. public.offboard_employee()
 *      SECURITY DEFINER lifecycle ceiling.
 *
 *   4. public.delete_employee_if_safe()
 *      SECURITY DEFINER lifecycle ceiling.
 *
 * This migration intentionally does NOT change employee data,
 * membership data, feature values, or existing HR history.
 */

BEGIN;


/*
 * ============================================================
 * 1. EMPLOYEE ROW AUTHORITY HELPER
 * ============================================================
 *
 * Used by employees INSERT / UPDATE / DELETE RLS policies.
 *
 * For UPDATE:
 *   - USING evaluates authority against the current row.
 *   - WITH CHECK evaluates authority against the resulting row.
 *
 * This blocks both:
 *   - an Admin modifying an existing Employee Admin, and
 *   - an Admin promoting an ordinary employee to Employee Admin.
 *
 * Ordinary HR field edits remain available for employee records
 * that are within the actor's authority ceiling.
 */

CREATE OR REPLACE FUNCTION private.can_manage_employee_authority(
  target_org_id uuid,
  target_user_id uuid,
  target_employee_role public.employee_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS actor
    WHERE actor.org_id =
          $1
      AND actor.user_id = (SELECT auth.uid())
      AND (
        actor.role = 'owner'::public.role_enum

        OR

        (
          actor.role = 'admin'::public.role_enum

          AND
          $3
            <> 'admin'::public.employee_role

          AND (
            $2
              IS NULL

            OR EXISTS (
              SELECT 1
              FROM public.memberships AS target
              WHERE target.org_id =
                    $1
                AND target.user_id =
                    $2
                AND target.role =
                    'member'::public.role_enum
            )
          )
        )
      )
  );
$$;


/*
 * ============================================================
 * 2. DIRECT EMPLOYEE TABLE WRITE CEILING
 * ============================================================
 */

DROP POLICY IF EXISTS employees_insert_admin
ON public.employees;

DROP POLICY IF EXISTS employees_update_admin
ON public.employees;

DROP POLICY IF EXISTS employees_delete_admin
ON public.employees;


/*
 * Owner:
 *   all employee roles / linked membership roles.
 *
 * Admin:
 *   non-admin employee role only;
 *   linked account, when present, must be membership MEMBER.
 */

CREATE POLICY employees_insert_admin
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
  private.can_manage_employee_authority(
    org_id,
    user_id,
    role
  )
);


CREATE POLICY employees_update_admin
ON public.employees
FOR UPDATE
TO authenticated
USING (
  private.can_manage_employee_authority(
    org_id,
    user_id,
    role
  )
)
WITH CHECK (
  private.can_manage_employee_authority(
    org_id,
    user_id,
    role
  )
);


CREATE POLICY employees_delete_admin
ON public.employees
FOR DELETE
TO authenticated
USING (
  private.can_manage_employee_authority(
    org_id,
    user_id,
    role
  )
);


/*
 * ============================================================
 * 2B. DIRECT MEMBERSHIP TABLE WRITE HARDENING
 * ============================================================
 *
 * Membership authority changes are intentionally routed through
 * trusted server/service-role paths or SECURITY DEFINER RPCs.
 *
 * authenticated application sessions only need SELECT access.
 *
 * RLS currently exposes no authenticated INSERT / UPDATE / DELETE
 * policy on memberships, but table grants still exist. Remove those
 * unnecessary grants as defense in depth.
 *
 * TRUNCATE must be revoked explicitly because row-level security
 * does not protect table-wide TRUNCATE operations.
 */

REVOKE INSERT
ON TABLE public.memberships
FROM authenticated;

REVOKE UPDATE
ON TABLE public.memberships
FROM authenticated;

REVOKE DELETE
ON TABLE public.memberships
FROM authenticated;

REVOKE TRUNCATE
ON TABLE public.memberships
FROM authenticated;


/*
 * ============================================================
 * 3. UPDATE_MEMBER_ACCESS RPC CEILING
 * ============================================================
 */

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
  target_employee_role text;
  current_owner_count integer;
BEGIN

  SELECT m.role::text
  INTO actor_role
  FROM public.memberships AS m
  WHERE m.user_id = actor_id
    AND m.org_id = update_member_access.org_id;

  IF actor_role IS NULL THEN
    RAISE EXCEPTION
      'Actor not found in organization';
  END IF;

  IF actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION
      'Member cannot change organization permissions';
  END IF;


  SELECT m.role::text
  INTO target_current_role
  FROM public.memberships AS m
  WHERE m.user_id = update_member_access.target_user_id
    AND m.org_id = update_member_access.org_id;

  IF target_current_role IS NULL THEN
    RAISE EXCEPTION
      'Target user not found in organization';
  END IF;


  SELECT e.role::text
  INTO target_employee_role
  FROM public.employees AS e
  WHERE e.user_id = update_member_access.target_user_id
    AND e.org_id = update_member_access.org_id;


  IF update_member_access.new_features IS NOT NULL
     AND jsonb_typeof(
       update_member_access.new_features
     ) <> 'array' THEN

    RAISE EXCEPTION
      'new_features must be a JSON array';

  END IF;


  /*
   * Membership Admin grant ceiling.
   */

  IF actor_role = 'admin' THEN

    IF target_current_role <> 'member' THEN
      RAISE EXCEPTION
        'Admin can only manage member permissions';
    END IF;

    IF target_employee_role = 'admin' THEN
      RAISE EXCEPTION
        'Admin cannot modify employee-admin permissions';
    END IF;

    IF update_member_access.new_membership_role
         IS NOT NULL
       AND update_member_access.new_membership_role
         <> 'member'::public.role_enum THEN

      RAISE EXCEPTION
        'Only owner can grant membership owner/admin authority';

    END IF;

    IF update_member_access.new_employee_role
         = 'admin'::public.employee_role THEN

      RAISE EXCEPTION
        'Only owner can grant employee-admin authority';

    END IF;

  END IF;


  /*
   * Preserve owner-specific protection.
   */

  IF target_current_role = 'owner'
     AND actor_role <> 'owner' THEN

    RAISE EXCEPTION
      'Admin cannot modify owner permissions';

  END IF;


  IF update_member_access.new_membership_role
       = 'owner'::public.role_enum
     AND actor_role <> 'owner' THEN

    RAISE EXCEPTION
      'Only owner can grant owner role';

  END IF;


  IF update_member_access.new_membership_role
       IS NOT NULL THEN

    IF update_member_access.new_membership_role
         <> 'owner'::public.role_enum
       AND target_current_role = 'owner' THEN

      SELECT COUNT(*)
      INTO current_owner_count
      FROM public.memberships AS m
      WHERE m.org_id = update_member_access.org_id
        AND m.role = 'owner'::public.role_enum;

      IF current_owner_count = 1 THEN
        RAISE EXCEPTION
          'Cannot demote the last owner';
      END IF;

    END IF;

    UPDATE public.memberships AS m
    SET role =
      update_member_access.new_membership_role
    WHERE m.user_id =
          update_member_access.target_user_id
      AND m.org_id =
          update_member_access.org_id;

  END IF;


  IF EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.user_id =
          update_member_access.target_user_id
      AND e.org_id =
          update_member_access.org_id
  ) THEN

    IF update_member_access.new_employee_role
         IS NOT NULL THEN

      UPDATE public.employees AS e
      SET role =
        update_member_access.new_employee_role
      WHERE e.user_id =
            update_member_access.target_user_id
        AND e.org_id =
            update_member_access.org_id;

    END IF;


    IF update_member_access.new_features
         IS NOT NULL THEN

      UPDATE public.employees AS e
      SET allowed_features =
        update_member_access.new_features
      WHERE e.user_id =
            update_member_access.target_user_id
        AND e.org_id =
            update_member_access.org_id;

    END IF;

  ELSE

    IF update_member_access.new_employee_role
         IS NOT NULL
       OR update_member_access.new_features
         IS NOT NULL THEN

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


/*
 * ============================================================
 * 4. OFFBOARD RPC CEILING
 * ============================================================
 */

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
  target_employee_role text;
  actor_role text;
  target_membership_role text;
BEGIN

  SELECT
    e.org_id,
    e.user_id,
    e.role::text
  INTO
    target_org_id,
    target_user_id,
    target_employee_role
  FROM public.employees AS e
  WHERE e.id =
        offboard_employee.target_employee_id
  FOR UPDATE;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION
      'Employee not found';
  END IF;


  SELECT m.role::text
  INTO actor_role
  FROM public.memberships AS m
  WHERE m.user_id = actor_id
    AND m.org_id = target_org_id;

  IF actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION
      'Not authorized to offboard employee';
  END IF;


  IF target_user_id IS NOT NULL THEN

    SELECT m.role::text
    INTO target_membership_role
    FROM public.memberships AS m
    WHERE m.user_id = target_user_id
      AND m.org_id = target_org_id;

    /*
     * Preserve existing HR rule:
     * Owner accounts cannot be offboarded from HR.
     */

    IF target_membership_role = 'owner' THEN
      RAISE EXCEPTION
        'Owner cannot be offboarded from HR';
    END IF;

  END IF;


  /*
   * Membership Admin may offboard ordinary MEMBER /
   * non-admin employee targets only.
   */

  IF actor_role = 'admin' THEN

    IF target_employee_role = 'admin' THEN
      RAISE EXCEPTION
        'Not authorized to offboard employee';
    END IF;

    IF target_user_id IS NOT NULL
       AND target_membership_role
         IS DISTINCT FROM 'member' THEN

      RAISE EXCEPTION
        'Not authorized to offboard employee';

    END IF;

  END IF;


  UPDATE public.employees AS e
  SET is_active = false
  WHERE e.id =
        offboard_employee.target_employee_id
    AND e.org_id = target_org_id;


  IF target_user_id IS NOT NULL THEN

    DELETE FROM public.memberships AS m
    WHERE m.user_id = target_user_id
      AND m.org_id = target_org_id;

  END IF;

END;
$$;


REVOKE ALL ON FUNCTION public.offboard_employee(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.offboard_employee(uuid)
FROM anon;

GRANT EXECUTE ON FUNCTION public.offboard_employee(uuid)
TO authenticated;


/*
 * ============================================================
 * 5. PERMANENT DELETE RPC CEILING
 * ============================================================
 */

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
  target_employee_role text;
  actor_role text;
  history_count integer;
BEGIN

  SELECT
    e.org_id,
    e.user_id,
    e.role::text
  INTO
    target_org_id,
    target_user_id,
    target_employee_role
  FROM public.employees AS e
  WHERE e.id =
        delete_employee_if_safe.target_employee_id
  FOR UPDATE;

  IF target_org_id IS NULL THEN
    RAISE EXCEPTION
      'Employee not found';
  END IF;


  SELECT m.role::text
  INTO actor_role
  FROM public.memberships AS m
  WHERE m.user_id = actor_id
    AND m.org_id = target_org_id;

  IF actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION
      'Not authorized to delete employee';
  END IF;


  /*
   * Employee Admin is universal authority and may be
   * permanently deleted only by Owner.
   */

  IF actor_role = 'admin'
     AND target_employee_role = 'admin' THEN

    RAISE EXCEPTION
      'Not authorized to delete employee';

  END IF;


  IF target_user_id IS NOT NULL THEN

    RAISE EXCEPTION
      'EMPLOYEE_LINKED_USER: Unlink account before permanent delete';

  END IF;


  SELECT
      (
        SELECT COUNT(*)
        FROM public.leave_balances AS lb
        WHERE lb.employee_id =
              delete_employee_if_safe.target_employee_id
      )
    + (
        SELECT COUNT(*)
        FROM public.leave_requests AS lr
        WHERE lr.employee_id =
              delete_employee_if_safe.target_employee_id
      )
    + (
        SELECT COUNT(*)
        FROM public.timesheets AS ts
        WHERE ts.employee_id =
              delete_employee_if_safe.target_employee_id
      )
  INTO history_count;


  IF history_count <> 0 THEN

    RAISE EXCEPTION
      'EMPLOYEE_HAS_HISTORY: Use inactive/offboard instead';

  END IF;


  DELETE FROM public.employees AS e
  WHERE e.id =
        delete_employee_if_safe.target_employee_id
    AND e.org_id = target_org_id;

END;
$$;


REVOKE ALL ON FUNCTION public.delete_employee_if_safe(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.delete_employee_if_safe(uuid)
FROM anon;

GRANT EXECUTE ON FUNCTION public.delete_employee_if_safe(uuid)
TO authenticated;


COMMIT;
