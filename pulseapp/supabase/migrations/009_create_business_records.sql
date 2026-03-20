-- Business Records: universal file management for sector-specific record types
CREATE TABLE IF NOT EXISTS public.business_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('patient_file', 'client_file', 'case_file', 'pet', 'vehicle', 'diet_plan', 'student')),
  title text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS business_records_business_type_idx ON public.business_records (business_id, type);
CREATE INDEX IF NOT EXISTS business_records_customer_idx ON public.business_records (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_records_title_idx ON public.business_records USING gin(to_tsvector('turkish', title));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_business_records_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_records_updated_at
  BEFORE UPDATE ON public.business_records
  FOR EACH ROW EXECUTE FUNCTION update_business_records_updated_at();

-- RLS
ALTER TABLE public.business_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view their business records" ON public.business_records;
DROP POLICY IF EXISTS "Staff can insert business records" ON public.business_records;
DROP POLICY IF EXISTS "Staff can update business records" ON public.business_records;
DROP POLICY IF EXISTS "Staff can delete business records" ON public.business_records;

CREATE POLICY "Staff can view their business records"
  ON public.business_records FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff can insert business records"
  ON public.business_records FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff can update business records"
  ON public.business_records FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff can delete business records"
  ON public.business_records FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );
