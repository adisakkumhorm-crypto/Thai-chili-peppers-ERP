/*
 * SECURITY-HR-001D-B
 *
 * PRIVATE TIMESHEET PHOTO STORAGE
 *
 * Previous state:
 *
 *   - timesheet-photos bucket was public
 *   - any authenticated user could insert any object path
 *   - public SELECT policy exposed stored attendance photos
 *
 * New state:
 *
 *   - private bucket
 *   - JPEG only
 *   - maximum object size 5 MiB
 *   - object path:
 *
 *       <employee_uuid>/<random_uuid>.jpg
 *
 *   - self upload requires:
 *       organization membership
 *       linked employee identity
 *       /check-in capability
 *
 *   - HR kiosk upload requires:
 *       organization membership
 *       /hr capability
 *
 *   - no authenticated or anonymous SELECT policy
 *
 * Reading attendance photos, if required in the future, must use a
 * separately authorized read capability rather than public object URLs.
 */


DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'timesheet-photos'
  ) THEN
    RAISE EXCEPTION
      'timesheet-photos bucket does not exist';
  END IF;
END;
$block$;


/*
 * Bucket boundary.
 */
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types =
    ARRAY['image/jpeg']::text[]
WHERE id = 'timesheet-photos';


/*
 * Explicit capability used by the Storage INSERT policy.
 *
 * Accept text instead of uuid so malformed object paths evaluate to false
 * rather than throwing a cast exception inside an RLS policy.
 */
CREATE OR REPLACE FUNCTION private.can_upload_timesheet_photo(
  target_employee_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id::text = target_employee_id
      AND COALESCE(e.is_active, true) = true
      AND private.is_org_member(e.org_id)
      AND (
        (
          e.user_id = (
            SELECT auth.uid()
          )
          AND private.has_feature_access(
            e.org_id,
            '/check-in'
          )
        )
        OR private.has_feature_access(
          e.org_id,
          '/hr'
        )
      )
  );
$function$;


REVOKE ALL
ON FUNCTION private.can_upload_timesheet_photo(text)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION private.can_upload_timesheet_photo(text)
FROM anon;

GRANT EXECUTE
ON FUNCTION private.can_upload_timesheet_photo(text)
TO authenticated;


/*
 * Remove legacy policies.
 */
DROP POLICY IF EXISTS
  "Timesheet Public Access"
ON storage.objects;

DROP POLICY IF EXISTS
  "Timesheet Allow authenticated uploads"
ON storage.objects;


/*
 * Authorized upload only.
 *
 * Filename contract:
 *
 *   employee_uuid/random_uuid.jpg
 *
 * The first path segment is the security binding. The helper verifies that
 * the caller is either:
 *
 *   - the linked employee with /check-in access, or
 *   - an HR actor with /hr access in that employee's organization.
 */
CREATE POLICY "Timesheet Authorized Photo Upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'timesheet-photos'

  AND name ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'

  AND private.can_upload_timesheet_photo(
    split_part(name, '/', 1)
  )
);


/*
 * Intentionally no SELECT / UPDATE / DELETE policy for this bucket.
 *
 * Table-level grants may exist in the Supabase storage schema, but RLS has
 * no policy authorizing those operations for this bucket.
 */
