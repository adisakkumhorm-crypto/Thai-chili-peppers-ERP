CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shifts in their org" ON public.shifts
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert shifts" ON public.shifts
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update shifts" ON public.shifts
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete shifts" ON public.shifts
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

ALTER TABLE public.organizations ADD COLUMN timezone TEXT DEFAULT 'Asia/Bangkok';
