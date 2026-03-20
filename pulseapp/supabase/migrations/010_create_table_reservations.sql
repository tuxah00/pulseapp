-- Table Reservations: for restaurant and cafe sectors
CREATE TABLE IF NOT EXISTS public.table_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  party_size integer NOT NULL DEFAULT 2 CHECK (party_size > 0),
  table_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','seated','completed','cancelled','no_show')),
  notes text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','web')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS table_reservations_business_date_idx ON public.table_reservations (business_id, reservation_date);
CREATE INDEX IF NOT EXISTS table_reservations_status_idx ON public.table_reservations (business_id, status);

ALTER TABLE public.table_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view reservations"
  ON public.table_reservations FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can insert reservations"
  ON public.table_reservations FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can update reservations"
  ON public.table_reservations FOR UPDATE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Staff can delete reservations"
  ON public.table_reservations FOR DELETE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));
