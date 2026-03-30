-- Packages (Paket Tanımları): Tüm sektörlerde kullanılabilir
-- Örn: "10 Seans Epilasyon Paketi", "5 Randevu Paketi", "Aylık Bakım Paketi"
CREATE TABLE IF NOT EXISTS public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,                          -- "10 Seans Epilasyon"
  description text,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,  -- Hangi hizmete ait
  sessions_total integer NOT NULL DEFAULT 1 CHECK (sessions_total > 0),
  price numeric(10,2) NOT NULL DEFAULT 0,
  validity_days integer,                        -- Geçerlilik süresi (gün), NULL = süresiz
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_packages_business_idx ON public.service_packages (business_id, is_active);

-- Müşteri Paketleri: Müşterinin satın aldığı paketler
CREATE TABLE IF NOT EXISTS public.customer_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.service_packages(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  package_name text NOT NULL,                  -- Satın alındığı anki ad (değişebilir)
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  sessions_total integer NOT NULL DEFAULT 1 CHECK (sessions_total > 0),
  sessions_used integer NOT NULL DEFAULT 0 CHECK (sessions_used >= 0),
  price_paid numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled','expired')),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,                            -- NULL = süresiz
  notes text,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Kalan seans kontrol
  CONSTRAINT sessions_used_lte_total CHECK (sessions_used <= sessions_total)
);

CREATE INDEX IF NOT EXISTS customer_packages_business_status_idx ON public.customer_packages (business_id, status);
CREATE INDEX IF NOT EXISTS customer_packages_customer_idx ON public.customer_packages (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_packages_expiry_idx ON public.customer_packages (business_id, expiry_date) WHERE expiry_date IS NOT NULL;

-- Paket Kullanım Geçmişi: Her seans düşümü kaydı
CREATE TABLE IF NOT EXISTS public.package_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_package_id uuid NOT NULL REFERENCES public.customer_packages(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS package_usages_customer_package_idx ON public.package_usages (customer_package_id);
CREATE INDEX IF NOT EXISTS package_usages_appointment_idx ON public.package_usages (appointment_id) WHERE appointment_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_service_packages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER service_packages_updated_at
  BEFORE UPDATE ON public.service_packages
  FOR EACH ROW EXECUTE FUNCTION update_service_packages_updated_at();

CREATE OR REPLACE FUNCTION update_customer_packages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER customer_packages_updated_at
  BEFORE UPDATE ON public.customer_packages
  FOR EACH ROW EXECUTE FUNCTION update_customer_packages_updated_at();

-- RLS: service_packages
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view service_packages" ON public.service_packages;
CREATE POLICY "Staff can view service_packages"
  ON public.service_packages FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can insert service_packages" ON public.service_packages;
CREATE POLICY "Staff can insert service_packages"
  ON public.service_packages FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can update service_packages" ON public.service_packages;
CREATE POLICY "Staff can update service_packages"
  ON public.service_packages FOR UPDATE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can delete service_packages" ON public.service_packages;
CREATE POLICY "Staff can delete service_packages"
  ON public.service_packages FOR DELETE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

-- RLS: customer_packages
ALTER TABLE public.customer_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view customer_packages" ON public.customer_packages;
CREATE POLICY "Staff can view customer_packages"
  ON public.customer_packages FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can insert customer_packages" ON public.customer_packages;
CREATE POLICY "Staff can insert customer_packages"
  ON public.customer_packages FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can update customer_packages" ON public.customer_packages;
CREATE POLICY "Staff can update customer_packages"
  ON public.customer_packages FOR UPDATE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can delete customer_packages" ON public.customer_packages;
CREATE POLICY "Staff can delete customer_packages"
  ON public.customer_packages FOR DELETE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

-- RLS: package_usages
ALTER TABLE public.package_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view package_usages" ON public.package_usages;
CREATE POLICY "Staff can view package_usages"
  ON public.package_usages FOR SELECT TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can insert package_usages" ON public.package_usages;
CREATE POLICY "Staff can insert package_usages"
  ON public.package_usages FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Staff can delete package_usages" ON public.package_usages;
CREATE POLICY "Staff can delete package_usages"
  ON public.package_usages FOR DELETE TO authenticated
  USING (business_id IN (SELECT business_id FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));
