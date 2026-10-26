/*
 * SECURITY-HR-001C
 *
 * Timesheet / check-in capability boundary.
 *
 * Principles:
 *
 *   1. Authenticated application users do NOT write timesheets directly.
 *
 *   2. Check-in/out is performed through one guarded capability:
 *        public.rpc_timesheet_punch(...)
 *
 *      Self-service:
 *        employee.user_id must equal auth.uid().
 *
 *      HR kiosk:
 *        actor must have /hr authority before punching another employee.
 *
 *   3. OT multiplier changes are performed through:
 *        public.rpc_update_timesheet_ot_multiplier(...)
 *
 *      Only /hr authority may execute the business mutation.
 *
 *   4. Read model:
 *        self            -> own timesheets
 *        /hr             -> all organization timesheets
 *        /hr/payroll     -> completed organization timesheets only
 *
 *   5. DELETE / TRUNCATE / direct INSERT / direct UPDATE are removed
 *      from authenticated sessions.
 *
 *   6. One employee may have at most one timesheet per organization
 *      work date.
 *
 * SECURITY-HR-001D handles biometric descriptors and photo storage.
 */


CREATE UNIQUE INDEX IF NOT EXISTS
  timesheets_org_employee_work_date_uniq
ON public.timesheets (
  org_id,
  employee_id,
  work_date
);


/*
 * CHECK-IN / CHECK-OUT CAPABILITY
 */
CREATE OR REPLACE FUNCTION public.rpc_timesheet_punch(
  p_org_id uuid,
  p_intent text,
  p_employee_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_photo_path text DEFAULT NULL,
  p_location jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_employee public.employees%ROWTYPE;
  v_timesheet public.timesheets%ROWTYPE;
  v_effective_intent text;

  v_now timestamptz;
  v_timezone text;
  v_work_date date;

  v_hours numeric;
  v_effective_hours numeric;
  v_regular_hours numeric;
  v_ot_hours numeric;
  v_ot_multiplier numeric := 1.5;
  v_hourly_rate numeric;
  v_wage_amount numeric;
BEGIN
  v_actor := auth.uid();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization is required';
  END IF;

  IF NOT private.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Organization access denied';
  END IF;

  IF p_intent IS NULL
     OR p_intent NOT IN (
       'check_in',
       'check_out',
       'auto'
     )
  THEN
    RAISE EXCEPTION 'Invalid timesheet intent';
  END IF;


  /*
   * Self-service deliberately derives employee identity from auth.uid()
   * when no explicit employee is supplied.
   *
   * An explicit employee ID is permitted only when:
   *   - it belongs to the actor, OR
   *   - the actor has /hr authority.
   */
  IF p_employee_id IS NULL THEN

    SELECT e.*
    INTO v_employee
    FROM public.employees AS e
    WHERE e.org_id = p_org_id
      AND e.user_id = v_actor
      AND e.is_active = true
    LIMIT 1;

  ELSE

    SELECT e.*
    INTO v_employee
    FROM public.employees AS e
    WHERE e.org_id = p_org_id
      AND e.id = p_employee_id
      AND e.is_active = true
    LIMIT 1;

    IF FOUND
       AND v_employee.user_id IS DISTINCT FROM v_actor
       AND NOT private.has_feature_access(
         p_org_id,
         '/hr'
       )
    THEN
      RAISE EXCEPTION 'Timesheet punch authority denied';
    END IF;

  END IF;


  IF v_employee.id IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;


  /*
   * Optional project must belong to the same organization.
   */
  IF p_project_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.projects AS p
       WHERE p.id = p_project_id
         AND p.org_id = p_org_id
     )
  THEN
    RAISE EXCEPTION 'Invalid project';
  END IF;


  v_now := clock_timestamp();

  SELECT COALESCE(
    NULLIF(o.timezone, ''),
    'Asia/Bangkok'
  )
  INTO v_timezone
  FROM public.organizations AS o
  WHERE o.id = p_org_id;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  v_work_date :=
    (v_now AT TIME ZONE v_timezone)::date;


  SELECT t.*
  INTO v_timesheet
  FROM public.timesheets AS t
  WHERE t.org_id = p_org_id
    AND t.employee_id = v_employee.id
    AND t.work_date = v_work_date
  LIMIT 1
  FOR UPDATE;


  /*
   * Legacy HR kiosk compatibility:
   *
   * The HR scanner historically did not send an explicit intent.
   * Preserve that workflow through an explicit RPC-level auto mode:
   *
   *   no row / no check-in -> check_in
   *   checked in only      -> check_out
   *   already checked out  -> reject
   *
   * The decision is made from authoritative database state, not
   * from client-side assumptions.
   */
  v_effective_intent := p_intent;

  IF v_effective_intent = 'auto' THEN

    IF v_timesheet.id IS NULL
       OR v_timesheet.check_in IS NULL
    THEN
      v_effective_intent := 'check_in';

    ELSIF v_timesheet.check_out IS NULL THEN
      v_effective_intent := 'check_out';

    ELSE
      RAISE EXCEPTION 'Already checked out today';
    END IF;

  END IF;


  IF v_effective_intent = 'check_in' THEN

    IF v_timesheet.id IS NOT NULL
       AND v_timesheet.check_in IS NOT NULL
    THEN
      RAISE EXCEPTION 'Already checked in today';
    END IF;

    INSERT INTO public.timesheets (
      org_id,
      employee_id,
      project_id,
      work_date,
      check_in,
      status,
      check_in_photo,
      check_in_location
    )
    VALUES (
      p_org_id,
      v_employee.id,
      p_project_id,
      v_work_date,
      v_now,
      'working',
      p_photo_path,
      p_location
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'check_in',
      'employeeName', v_employee.first_name
    );

  END IF;


  /*
   * CHECK OUT
   */
  IF v_timesheet.id IS NULL
     OR v_timesheet.check_in IS NULL
  THEN
    RAISE EXCEPTION 'No check-in found for today';
  END IF;

  IF v_timesheet.check_out IS NOT NULL THEN
    RAISE EXCEPTION 'Already checked out today';
  END IF;


  v_hours :=
    GREATEST(
      EXTRACT(
        EPOCH FROM (
          v_now - v_timesheet.check_in
        )
      ) / 3600,
      0
    );

  /*
   * Preserve existing business rule:
   * subtract one-hour break when elapsed time > 5 hours.
   */
  v_effective_hours :=
    CASE
      WHEN v_hours > 5
        THEN GREATEST(v_hours - 1, 0)
      ELSE v_hours
    END;

  v_regular_hours :=
    LEAST(8, v_effective_hours);

  v_ot_hours :=
    GREATEST(0, v_effective_hours - 8);

  v_hourly_rate :=
    COALESCE(v_employee.daily_wage, 0) / 8;

  v_wage_amount :=
      (v_regular_hours * v_hourly_rate)
    + (
        v_ot_hours
        * v_hourly_rate
        * v_ot_multiplier
      );


  UPDATE public.timesheets
  SET
    check_out = v_now,
    regular_hours = ROUND(v_regular_hours, 2),
    ot_hours = ROUND(v_ot_hours, 2),
    ot_multiplier = v_ot_multiplier,
    wage_amount = ROUND(v_wage_amount, 2),
    status = 'completed',
    check_out_photo = p_photo_path,
    check_out_location = p_location,
    updated_at = v_now
  WHERE id = v_timesheet.id;


  RETURN jsonb_build_object(
    'success', true,
    'action', 'check_out',
    'employeeName', v_employee.first_name,
    'hours', ROUND(v_hours, 2)
  );
END;
$function$;


/*
 * HR OT-MULTIPLIER CAPABILITY
 */
CREATE OR REPLACE FUNCTION public.rpc_update_timesheet_ot_multiplier(
  p_org_id uuid,
  p_timesheet_id uuid,
  p_multiplier numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_timesheet public.timesheets%ROWTYPE;
  v_daily_wage numeric;
  v_hourly_rate numeric;
  v_wage_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT private.has_feature_access(
    p_org_id,
    '/hr'
  )
  THEN
    RAISE EXCEPTION 'HR authority required';
  END IF;

  IF p_multiplier IS NULL
     OR p_multiplier NOT IN (
       1,
       1.5,
       2,
       3
     )
  THEN
    RAISE EXCEPTION 'Invalid OT multiplier';
  END IF;


  /*
   * Lock the authoritative timesheet row first.
   *
   * PL/pgSQL row variables cannot be mixed with scalar targets in
   * one multi-item INTO list, so employee wage is fetched separately.
   */
  SELECT t.*
  INTO v_timesheet
  FROM public.timesheets AS t
  WHERE t.id = p_timesheet_id
    AND t.org_id = p_org_id
  LIMIT 1
  FOR UPDATE;


  IF v_timesheet.id IS NULL THEN
    RAISE EXCEPTION 'Timesheet not found';
  END IF;


  SELECT e.daily_wage
  INTO v_daily_wage
  FROM public.employees AS e
  WHERE e.id = v_timesheet.employee_id
    AND e.org_id = v_timesheet.org_id
  LIMIT 1;


  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;


  IF v_timesheet.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Only completed timesheets may be adjusted';
  END IF;


  v_hourly_rate :=
    COALESCE(v_daily_wage, 0) / 8;

  v_wage_amount :=
      (
        COALESCE(v_timesheet.regular_hours, 0)
        * v_hourly_rate
      )
    + (
        COALESCE(v_timesheet.ot_hours, 0)
        * v_hourly_rate
        * p_multiplier
      );


  UPDATE public.timesheets
  SET
    ot_multiplier = p_multiplier,
    wage_amount = ROUND(v_wage_amount, 2),
    updated_at = clock_timestamp()
  WHERE id = p_timesheet_id
    AND org_id = p_org_id;


  RETURN jsonb_build_object(
    'success', true,
    'timesheetId', p_timesheet_id,
    'multiplier', p_multiplier,
    'wageAmount', ROUND(v_wage_amount, 2)
  );
END;
$function$;


/*
 * RPC execution boundary.
 */
REVOKE ALL
ON FUNCTION public.rpc_timesheet_punch(
  uuid,
  text,
  uuid,
  uuid,
  text,
  jsonb
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_timesheet_punch(
  uuid,
  text,
  uuid,
  uuid,
  text,
  jsonb
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_timesheet_punch(
  uuid,
  text,
  uuid,
  uuid,
  text,
  jsonb
)
TO authenticated;


REVOKE ALL
ON FUNCTION public.rpc_update_timesheet_ot_multiplier(
  uuid,
  uuid,
  numeric
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_update_timesheet_ot_multiplier(
  uuid,
  uuid,
  numeric
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_update_timesheet_ot_multiplier(
  uuid,
  uuid,
  numeric
)
TO authenticated;


/*
 * Remove broad same-org CRUD policy.
 */
DROP POLICY IF EXISTS timesheets_rw
ON public.timesheets;

DROP POLICY IF EXISTS timesheets_select_authorized
ON public.timesheets;


/*
 * Read model:
 *
 * Self:
 *   own timesheets.
 *
 * HR:
 *   all organization timesheets.
 *
 * Payroll-only:
 *   completed organization timesheets only.
 */
CREATE POLICY timesheets_select_authorized
ON public.timesheets
FOR SELECT
TO authenticated
USING (
  private.is_org_member(org_id)
  AND (
    EXISTS (
      SELECT 1
      FROM public.employees AS e
      WHERE e.id = timesheets.employee_id
        AND e.org_id = timesheets.org_id
        AND e.user_id = (SELECT auth.uid())
    )
    OR private.has_feature_access(
      org_id,
      '/hr'
    )
    OR (
      status = 'completed'
      AND private.has_feature_access(
        org_id,
        '/hr/payroll'
      )
    )
  )
);


/*
 * Direct authenticated mutation is forbidden.
 *
 * All business mutation now goes through the guarded capability RPCs.
 */
REVOKE ALL PRIVILEGES
ON TABLE public.timesheets
FROM authenticated;

REVOKE ALL PRIVILEGES
ON TABLE public.timesheets
FROM anon;

GRANT SELECT
ON TABLE public.timesheets
TO authenticated;
