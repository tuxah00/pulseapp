-- ================================================================
-- 066 — Sektörel Benchmark Agregatları (Faz 5.3)
-- Opt-in işletmelerden anonim metrikler toplanır; business_id asla
-- saklanmaz. Her çeyrek için en az 20 işletme sample'ı şart
-- (aksi halde agregat satırı yazılmaz — gizlilik koruması).
-- ================================================================

CREATE TABLE IF NOT EXISTS sector_benchmarks_aggregate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN (
    'avg_ticket',        -- ortalama bilet (₺)
    'occupancy',         -- doluluk (%)
    'retention_rate',    -- elde tutma oranı (%)
    'no_show_rate',      -- no-show oranı (%)
    'new_customer_rate'  -- yeni müşteri oranı (%)
  )),
  p25 NUMERIC NOT NULL,
  p50 NUMERIC NOT NULL,
  p75 NUMERIC NOT NULL,
  sample_size INT NOT NULL CHECK (sample_size >= 20),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aynı sektör + metric + dönem için tek agregat satırı
CREATE UNIQUE INDEX IF NOT EXISTS uq_benchmarks_sector_metric_period
  ON sector_benchmarks_aggregate (sector, metric, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_benchmarks_sector_metric
  ON sector_benchmarks_aggregate (sector, metric, computed_at DESC);

-- RLS: herkes okuyabilir (anonim agregat) — yazma yok (cron admin client kullanır)
ALTER TABLE sector_benchmarks_aggregate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS benchmarks_public_read ON sector_benchmarks_aggregate;
CREATE POLICY benchmarks_public_read
  ON sector_benchmarks_aggregate
  FOR SELECT
  USING (true);

-- Yardım fonksiyonu: Bir işletme opt-in mi? (business settings.benchmark_opt_in)
-- Varsayılan: false — kullanıcı settings'ten açabilir
COMMENT ON TABLE sector_benchmarks_aggregate IS
  'Anonim sektörel benchmark agregatları. Opt-in işletmelerden toplanır. business_id kesinlikle saklanmaz.';
