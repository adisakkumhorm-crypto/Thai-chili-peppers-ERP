/*
 * SECURITY-HR-001B
 *
 * Leave authorization boundary.
 *
 * Goals:
 *   - Employees may read their own leave requests/balances.
 *   - Employees may create pending leave requests for themselves only.
 *   - HR-authorized actors may manage organization-wide leave workflow.
 *   - Payroll-authorized actors may read approved leave data required
 *     by the existing payroll workflow.
 *   - Ordinary organization membership alone is NOT management authority.
 *   - Direct DELETE and TRUNCATE are removed from authenticated sessions.
 *
 * Feature semantics mirror application authorization:
 *   - membership owner/admin = universal administrative access
 *   - employee role admin    = universal feature access
 *   - allowed_features       = hierarchical path permission
 *
 * Legacy feature IDs without a leading slash are accepted for
 * compatibility, e.g. "hr" is treated as "/hr".
 */


/*
 * Generic feature permission helper.
 *
 * Example:
 *   target "/hr/payroll"
 *
 * Allowed feature "/hr"         -> PASS
 * Allowed feature "/hr/payroll" -> PASS
 * Allowed feature "/finance"    -> FAIL
 */
CREATE OR REPLACE FUNCTION private.has_feature_access(
  target_org uuid,
  target_feature text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS m
    LEFT JOIN public.employees AS e
      ON e.org_id = m.org_id
     AND e.user_id = m.user_id
    WHERE m.org_id = target_org
      AND m.user_id = (SELECT auth.uid())
      AND (
        m.role IN (
          'owner'::public.role_enum,
          'admin'::public.role_enum
        )
        OR e.role = 'admin'::public.employee_role
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(e.allowed_features) = 'array'
                THEN e.allowed_features
              ELSE '[]'::jsonb
            END
          ) AS feature(value)
          WHERE
            ('/' || ltrim(target_feature, '/'))
              =
            ('/' || ltrim(feature.value, '/'))
            OR
            ('/' || ltrim(target_feature, '/'))
              LIKE
            ('/' || ltrim(feature.value, '/')) || '/%'
        )
      )
  );
$function$;

REVOKE ALL
ON FUNCTION private.has_feature_access(uuid, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION private.has_feature_access(uuid, text)
TO authenticated;


/*
 * Remove broad same-org policies.
 */
DROP POLICY IF EXISTS leave_requests_rw
ON public.leave_requests;

DROP POLICY IF EXISTS leave_balances_rw
ON public.leave_balances;


/*
 * Idempotent names for retry/review environments.
 */
DROP POLICY IF EXISTS leave_requests_select_authorized
ON public.leave_requests;

DROP POLICY IF EXISTS leave_requests_insert_self
ON public.leave_requests;

DROP POLICY IF EXISTS leave_requests_update_hr
ON public.leave_requests;

DROP POLICY IF EXISTS leave_balances_select_authorized
ON public.leave_balances;

DROP POLICY IF EXISTS leave_balances_insert_hr
ON public.leave_balances;

DROP POLICY IF EXISTS leave_balances_update_hr
ON public.leave_balances;


/*
 * LEAVE REQUESTS — SELECT
 *
 * Employee:
 *   own requests only.
 *
 * HR:
 *   organization-wide requests.
 *
 * Payroll:
 *   read access is required by the existing payroll workflow.
 *
 * Passing "/hr/payroll" intentionally also accepts parent "/hr"
 * through private.has_feature_access hierarchical matching.
 */
CREATE POLICY leave_requests_select_authorized
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  private.is_org_member(org_id)
  AND (
    EXISTS (
      SELECT 1
      FROM public.employees AS e
      WHERE e.id = leave_requests.employee_id
        AND e.org_id = leave_requests.org_id
        AND e.user_id = (SELECT auth.uid())
    )
    OR private.has_feature_access(
      org_id,
      '/hr'
    )
    OR (
      status = 'approved'::public.leave_status
      AND private.has_feature_access(
        org_id,
        '/hr/payroll'
      )
    )
  )
);


/*
 * LEAVE REQUESTS — INSERT
 *
 * Self-service only.
 *
 * A direct client cannot:
 *   - submit for another employee
 *   - create an already-approved/rejected request
 *   - forge approved_by
 */
CREATE POLICY leave_requests_insert_self
ON public.leave_requests
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_org_member(org_id)
  AND status = 'pending'::public.leave_status
  AND approved_by IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id = leave_requests.employee_id
      AND e.org_id = leave_requests.org_id
      AND e.user_id = (SELECT auth.uid())
  )
);


/*
 * LEAVE REQUESTS — UPDATE
 *
 * Approval/rejection is HR-management authority.
 *
 * WITH CHECK also prevents moving the request to an employee
 * belonging to another organization.
 */
CREATE POLICY leave_requests_update_hr
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  private.has_feature_access(
    org_id,
    '/hr'
  )
)
WITH CHECK (
  private.has_feature_access(
    org_id,
    '/hr'
  )
  AND status IN (
    'approved'::public.leave_status,
    'rejected'::public.leave_status
  )
  AND approved_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id = leave_requests.employee_id
      AND e.org_id = leave_requests.org_id
  )
);


/*
 * LEAVE BALANCES — SELECT
 *
 * Employee sees own balance.
 * HR-authorized actor sees organization-wide balances.
 */
CREATE POLICY leave_balances_select_authorized
ON public.leave_balances
FOR SELECT
TO authenticated
USING (
  private.is_org_member(org_id)
  AND (
    EXISTS (
      SELECT 1
      FROM public.employees AS e
      WHERE e.id = leave_balances.employee_id
        AND e.org_id = leave_balances.org_id
        AND e.user_id = (SELECT auth.uid())
    )
    OR private.has_feature_access(
      org_id,
      '/hr'
    )
  )
);


/*
 * LEAVE BALANCES — INSERT / UPDATE
 *
 * HR workflow must be able to create/update balances when approving
 * paid leave. Ordinary members cannot mutate leave balances.
 */
CREATE POLICY leave_balances_insert_hr
ON public.leave_balances
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_feature_access(
    org_id,
    '/hr'
  )
  AND EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id = leave_balances.employee_id
      AND e.org_id = leave_balances.org_id
  )
);

CREATE POLICY leave_balances_update_hr
ON public.leave_balances
FOR UPDATE
TO authenticated
USING (
  private.has_feature_access(
    org_id,
    '/hr'
  )
)
WITH CHECK (
  private.has_feature_access(
    org_id,
    '/hr'
  )
  AND EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id = leave_balances.employee_id
      AND e.org_id = leave_balances.org_id
  )
);


/*
 * Column-level UPDATE authority.
 *
 * RLS answers WHO may update a leave request.
 * Column privileges additionally restrict WHAT may be changed.
 *
 * HR approval may change only:
 *   - status
 *   - approved_by
 *
 * Request ownership, dates, leave type, reason, unpaid flag and
 * organization identity remain immutable through direct authenticated
 * UPDATE.
 */
REVOKE UPDATE
ON TABLE public.leave_requests
FROM authenticated;

GRANT UPDATE (
  status,
  approved_by
)
ON TABLE public.leave_requests
TO authenticated;


/*
 * No authenticated DELETE workflow currently exists for either table.
 *
 * TRUNCATE bypasses row-level filtering and must never be available
 * to ordinary authenticated application sessions.
 */
REVOKE DELETE, TRUNCATE
ON TABLE public.leave_requests
FROM authenticated;

REVOKE DELETE, TRUNCATE
ON TABLE public.leave_balances
FROM authenticated;
