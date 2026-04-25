-- ================================================
-- 071_staff_services.sql
-- Personel-hizmet many-to-many junction tablosu
-- ================================================
-- Booking sayfasında ve admin randevu modal'ında, müşterinin seçtiği hizmeti
-- veremeyen personellerin listelenmemesi için kullanılır.
-- Geriye dönük uyum: mevcut tüm aktif personeller mevcut tüm aktif hizmetlere
-- otomatik atanır (booking'de görünmemelerini engellemek için).

CREATE TABLE IF NOT EXISTS public.staff_services (
  staff_id    uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES public.services(id)      ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id)    ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_services_business ON public.staff_services(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service  ON public.staff_services(service_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_staff    ON public.staff_services(staff_id);

ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi işletmesinin staff_services kayıtlarını okuyabilir
DROP POLICY IF EXISTS "staff_services_select" ON public.staff_services;
CREATE POLICY "staff_services_select" ON public.staff_services
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.staff_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Yalnızca owner/manager yazabilir
DROP POLICY IF EXISTS "staff_services_write" ON public.staff_services;
CREATE POLICY "staff_services_write" ON public.staff_services
  FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.staff_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.staff_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'manager')
    )
  );

-- Geriye dönük uyum: mevcut aktif personellere mevcut aktif hizmetleri ata.
-- Yeni özellikten önce oluşturulmuş personel kayıtları booking'de görünmeye
-- devam etsin. İşletme sahibi sonradan ince ayar yapabilir.
INSERT INTO public.staff_services (staff_id, service_id, business_id)
SELECT s.id, sv.id, s.business_id
FROM public.staff_members s
JOIN public.services sv
  ON sv.business_id = s.business_id
 AND sv.is_active = true
WHERE s.is_active = true
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.staff_services IS
  'Personel-hizmet eşleşmesi. Booking ve admin randevu modal''ında müsait personel filtresi için kullanılır.';
