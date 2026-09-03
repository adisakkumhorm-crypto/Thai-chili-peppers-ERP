-- Step 1: Create join_requests table
CREATE TABLE join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON join_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests FORCE ROW LEVEL SECURITY;

-- 1. Users can see their own requests
CREATE POLICY join_requests_select_own ON join_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 2. Users can create their own requests
CREATE POLICY join_requests_insert_own ON join_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 3. Admins can see all requests for their org
CREATE POLICY join_requests_select_admin ON join_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = join_requests.org_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
  );

-- 4. Admins can update requests for their org
CREATE POLICY join_requests_update_admin ON join_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = join_requests.org_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = join_requests.org_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
  );
