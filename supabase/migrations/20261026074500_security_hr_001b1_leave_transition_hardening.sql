/*
 * SECURITY-HR-001B.1
 *
 * Harden leave-request state transitions.
 *
 * SECURITY-HR-001B correctly restricts approval/rejection authority
 * to HR-authorized actors, but its UPDATE policy does not restrict the
 * OLD/current row to status = pending.
 *
 * That means an HR-authorized authenticated actor can currently perform:
 *
 *   approved -> rejected
 *   rejected -> approved
 *
 * through a direct authenticated UPDATE.
 *
 * This additive migration makes finalized requests immutable through
 * the authenticated leave-approval path:
 *
 *   pending  -> approved   ALLOWED
 *   pending  -> rejected   ALLOWED
 *
 *   approved -> anything   BLOCKED
 *   rejected -> anything   BLOCKED
 *
 * Table privileges established by SECURITY-HR-001B already restrict
 * authenticated UPDATE to status and approved_by only.
 */


DROP POLICY IF EXISTS leave_requests_update_hr
ON public.leave_requests;


CREATE POLICY leave_requests_update_hr
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  /*
   * USING is evaluated against the existing row.
   *
   * Only a currently-pending request may enter the approval/rejection
   * transition.
   */
  status = 'pending'::public.leave_status

  AND private.has_feature_access(
    org_id,
    '/hr'
  )
)
WITH CHECK (
  /*
   * WITH CHECK is evaluated against the resulting row.
   */
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
