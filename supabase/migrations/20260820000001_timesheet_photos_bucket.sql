-- Create timesheet-photos bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('timesheet-photos', 'timesheet-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for timesheet-photos
CREATE POLICY "Timesheet Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'timesheet-photos');

CREATE POLICY "Timesheet Allow authenticated uploads" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'timesheet-photos' AND 
  auth.role() = 'authenticated'
);
