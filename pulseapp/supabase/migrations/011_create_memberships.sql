-- Memberships: for fitness, yoga_pilates, spa_massage sectors
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  plan_name text NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  price numeric(10,2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','frozen','cancelled')),
  sessions_total integer,
  sessions_used integer NOT NULL DEFAULT 0 CHECK (sessions_used >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_business_status_idx ON public.memberships (business_id, status);
CREATE INDEX IF NOT EXISTS memberships_customer_idx ON public.memberships (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS memberships_end_date_idx ON public.memberships (business_id, end_date) WHERE end_date IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_memberships_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION update_memberships_updated_at();

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view memberships"
  ON public.memberships FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can insert memberships"
  ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can update memberships"
  ON public.memberships FOR UPDATE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can delete memberships"
  ON public.memberships FOR DELETE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));
