-- Migration: 004_create_products_table
-- Creates the products table for inventory/stock management

CREATE TABLE IF NOT EXISTS public.products (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name            text          NOT NULL,
  description     text,
  category        text,
  price           numeric(10,2),
  stock_count     integer       NOT NULL DEFAULT 0,
  min_stock_level integer       NOT NULL DEFAULT 5,
  unit            text          NOT NULL DEFAULT 'adet',
  is_active       boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

-- Index for fast lookups by business
CREATE INDEX IF NOT EXISTS products_business_id_idx ON public.products(business_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view products"
  ON public.products FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true
      UNION
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Business members can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true
      UNION
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Business members can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true
      UNION
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Business members can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true
      UNION
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );
