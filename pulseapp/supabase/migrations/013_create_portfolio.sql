-- Portfolio: photo gallery for photo_studio and tattoo_piercing sectors
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text,
  storage_path text,
  category text,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_business_idx ON public.portfolio_items (business_id);
CREATE INDEX IF NOT EXISTS portfolio_business_category_idx ON public.portfolio_items (business_id, category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS portfolio_featured_idx ON public.portfolio_items (business_id, is_featured) WHERE is_featured = true;

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Staff can manage their portfolio
DROP POLICY IF EXISTS "Staff can view portfolio" ON public.portfolio_items;
CREATE POLICY "Staff can view portfolio"
  ON public.portfolio_items FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can insert portfolio" ON public.portfolio_items;
CREATE POLICY "Staff can insert portfolio"
  ON public.portfolio_items FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can update portfolio" ON public.portfolio_items;
CREATE POLICY "Staff can update portfolio"
  ON public.portfolio_items FOR UPDATE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can delete portfolio" ON public.portfolio_items;
CREATE POLICY "Staff can delete portfolio"
  ON public.portfolio_items FOR DELETE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

-- Public can view featured portfolio items (for public booking page)
DROP POLICY IF EXISTS "Public can view portfolio" ON public.portfolio_items;
CREATE POLICY "Public can view portfolio"
  ON public.portfolio_items FOR SELECT TO anon
  USING (is_featured = true);
