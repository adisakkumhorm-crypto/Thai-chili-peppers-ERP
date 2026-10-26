/*
 * SECURITY-HR-001D-A
 *
 * BIOMETRIC ISOLATION
 *
 * Previous architecture:
 *
 *   public.employees.face_descriptor
 *
 * was readable through the general employee record and the face scanner
 * loaded every enrolled employee template in the organization into the
 * browser.
 *
 * New architecture:
 *
 *   private.employee_face_templates
 *
 * Biometric templates are no longer part of the general employee record.
 *
 * Access is only through explicit SECURITY DEFINER capabilities:
 *
 *   rpc_face_scan_templates
 *     - /hr actor: organization-wide enrolled active employees
 *     - /check-in actor: own linked employee only
 *
 *   rpc_face_enrollment_statuses
 *     - /hr only
 *     - exposes employee IDs only, never biometric values
 *
 *   rpc_set_face_template
 *     - /hr only
 *     - validates descriptor shape and employee organization
 *
 * No authenticated or anonymous role receives direct table access to
 * private.employee_face_templates.
 */


CREATE TABLE IF NOT EXISTS private.employee_face_templates (
  employee_id uuid PRIMARY KEY
    REFERENCES public.employees(id)
    ON DELETE CASCADE,

  org_id uuid NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  descriptor jsonb NOT NULL,

  updated_at timestamptz NOT NULL
    DEFAULT clock_timestamp(),

  updated_by uuid
);


REVOKE ALL PRIVILEGES
ON TABLE private.employee_face_templates
FROM PUBLIC, anon, authenticated;


/*
 * LEGACY BIOMETRIC MIGRATION
 *
 * Preserve any face templates that may be enrolled between security
 * preflight and production deployment.
 *
 * The JSON value is copied as-is. Existing application history may contain
 * either a JSON array or a JSON string representation; the server
 * normalization layer accepts both while all new enrollment writes use a
 * validated 128-number JSON array.
 */
INSERT INTO private.employee_face_templates (
  employee_id,
  org_id,
  descriptor,
  updated_at,
  updated_by
)
SELECT
  e.id,
  e.org_id,
  e.face_descriptor,
  clock_timestamp(),
  NULL
FROM public.employees AS e
WHERE e.face_descriptor IS NOT NULL
ON CONFLICT (employee_id)
DO UPDATE
SET
  org_id = EXCLUDED.org_id,
  descriptor = EXCLUDED.descriptor,
  updated_at = EXCLUDED.updated_at,
  updated_by = NULL;


/*
 * FACE-SCAN TEMPLATE CAPABILITY
 *
 * HR:
 *   may retrieve all active enrolled employee templates in its organization.
 *
 * Ordinary /check-in actor:
 *   may retrieve only the template belonging to the employee record linked
 *   to auth.uid().
 */
CREATE OR REPLACE FUNCTION public.rpc_face_scan_templates(
  p_org_id uuid
)
RETURNS TABLE (
  employee_id uuid,
  first_name text,
  last_name text,
  descriptor jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_is_hr boolean;
BEGIN
  v_actor := auth.uid();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT private.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Organization membership required';
  END IF;

  v_is_hr :=
    private.has_feature_access(
      p_org_id,
      '/hr'
    );

  IF NOT v_is_hr
     AND NOT private.has_feature_access(
       p_org_id,
       '/check-in'
     )
  THEN
    RAISE EXCEPTION 'Face scan authority required';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.first_name,
    e.last_name,
    f.descriptor
  FROM public.employees AS e
  JOIN private.employee_face_templates AS f
    ON f.employee_id = e.id
   AND f.org_id = e.org_id
  WHERE e.org_id = p_org_id
    AND COALESCE(e.is_active, true) = true
    AND (
      v_is_hr
      OR e.user_id = v_actor
    )
  ORDER BY e.first_name, e.id;
END;
$function$;


/*
 * FACE-ENROLLMENT STATUS
 *
 * HR UI needs to know whether an employee has an enrolled template, but it
 * does not need the template value itself.
 */
CREATE OR REPLACE FUNCTION public.rpc_face_enrollment_statuses(
  p_org_id uuid
)
RETURNS TABLE (
  employee_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $function$
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

  RETURN QUERY
  SELECT f.employee_id
  FROM private.employee_face_templates AS f
  JOIN public.employees AS e
    ON e.id = f.employee_id
   AND e.org_id = f.org_id
  WHERE f.org_id = p_org_id
  ORDER BY f.employee_id;
END;
$function$;


/*
 * FACE-ENROLLMENT WRITE CAPABILITY
 */
CREATE OR REPLACE FUNCTION public.rpc_set_face_template(
  p_org_id uuid,
  p_employee_id uuid,
  p_descriptor jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_employee public.employees%ROWTYPE;
BEGIN
  v_actor := auth.uid();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT private.has_feature_access(
    p_org_id,
    '/hr'
  )
  THEN
    RAISE EXCEPTION 'HR authority required';
  END IF;

  IF p_descriptor IS NULL
     OR jsonb_typeof(p_descriptor) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_descriptor) <> 128
  THEN
    RAISE EXCEPTION 'Invalid face descriptor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_descriptor) AS element
    WHERE jsonb_typeof(element) IS DISTINCT FROM 'number'
  )
  THEN
    RAISE EXCEPTION 'Invalid face descriptor values';
  END IF;

  SELECT e.*
  INTO v_employee
  FROM public.employees AS e
  WHERE e.id = p_employee_id
    AND e.org_id = p_org_id
    AND COALESCE(e.is_active, true) = true
  LIMIT 1;

  IF v_employee.id IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  INSERT INTO private.employee_face_templates (
    employee_id,
    org_id,
    descriptor,
    updated_at,
    updated_by
  )
  VALUES (
    v_employee.id,
    v_employee.org_id,
    p_descriptor,
    clock_timestamp(),
    v_actor
  )
  ON CONFLICT (employee_id)
  DO UPDATE
  SET
    org_id = EXCLUDED.org_id,
    descriptor = EXCLUDED.descriptor,
    updated_at = clock_timestamp(),
    updated_by = v_actor;

  RETURN jsonb_build_object(
    'success', true,
    'employeeId', v_employee.id
  );
END;
$function$;


/*
 * RPC EXECUTION BOUNDARY
 */

REVOKE ALL
ON FUNCTION public.rpc_face_scan_templates(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_face_scan_templates(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_face_scan_templates(uuid)
TO authenticated;


REVOKE ALL
ON FUNCTION public.rpc_face_enrollment_statuses(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_face_enrollment_statuses(uuid)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_face_enrollment_statuses(uuid)
TO authenticated;


REVOKE ALL
ON FUNCTION public.rpc_set_face_template(uuid, uuid, jsonb)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_set_face_template(uuid, uuid, jsonb)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_set_face_template(uuid, uuid, jsonb)
TO authenticated;


/*
 * Legacy values have been copied into the private biometric table above.
 *
 * Removing this public column eliminates accidental disclosure through
 * existing employee SELECT * queries.
 */
ALTER TABLE public.employees
DROP COLUMN IF EXISTS face_descriptor;
