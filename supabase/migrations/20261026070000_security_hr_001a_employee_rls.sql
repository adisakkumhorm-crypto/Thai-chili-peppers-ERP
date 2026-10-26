/*
 * SECURITY-HR-001A
 *
 * Purpose:
 *   Break same-organization privilege escalation through public.employees.
 *
 * Previous state:
 *   employees_rw FOR ALL allowed any authenticated organization member
 *   to operate on any employee row in the same organization.
 *
 * Security boundary:
 *   - SELECT remains available to authenticated members of the same org.
 *   - INSERT / UPDATE / DELETE require membership role owner or admin.
 *   - employee_role and allowed_features therefore cannot be changed by
 *     an ordinary member through direct table mutation.
 *   - TRUNCATE is explicitly revoked because row-level security does not
 *     provide row filtering for TRUNCATE.
 *
 * This migration intentionally does NOT change:
 *   - employee data
 *   - membership roles
 *   - allowed_features values
 *   - face scan/check-in logic
 *   - leave/timesheet policies
 */

DROP POLICY IF EXISTS employees_rw
ON public.employees;

DROP POLICY IF EXISTS employees_select_org_member
ON public.employees;

DROP POLICY IF EXISTS employees_insert_admin
ON public.employees;

DROP POLICY IF EXISTS employees_update_admin
ON public.employees;

DROP POLICY IF EXISTS employees_delete_admin
ON public.employees;


/*
 * Read compatibility.
 *
 * Existing HR dashboards, employee portal, face-scan lookup and other
 * current workflows rely on organization-scoped employee reads.
 */
CREATE POLICY employees_select_org_member
ON public.employees
FOR SELECT
TO authenticated
USING (
  private.is_org_member(org_id)
);


/*
 * Employee-master creation is an administrative operation.
 */
CREATE POLICY employees_insert_admin
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = employees.org_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role IN (
        'owner'::public.role_enum,
        'admin'::public.role_enum
      )
  )
);


/*
 * Employee-master mutation is an administrative operation.
 *
 * WITH CHECK repeats the authority condition against the resulting row,
 * preventing an authorized update from moving a row into an organization
 * where the actor has no administrative authority.
 */
CREATE POLICY employees_update_admin
ON public.employees
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = employees.org_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role IN (
        'owner'::public.role_enum,
        'admin'::public.role_enum
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = employees.org_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role IN (
        'owner'::public.role_enum,
        'admin'::public.role_enum
      )
  )
);


/*
 * Direct employee deletion is administrative only.
 *
 * Application-level permanent deletion/offboarding RPCs retain their own
 * additional safety checks and history guards.
 */
CREATE POLICY employees_delete_admin
ON public.employees
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships AS m
    WHERE m.org_id = employees.org_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role IN (
        'owner'::public.role_enum,
        'admin'::public.role_enum
      )
  )
);


/*
 * Least privilege:
 * TRUNCATE is table-wide and must never be available to ordinary
 * authenticated application sessions.
 */
REVOKE TRUNCATE
ON TABLE public.employees
FROM authenticated;
