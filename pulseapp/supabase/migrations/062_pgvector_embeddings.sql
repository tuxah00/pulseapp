-- AI Anlamsal Arama (RAG) Altyapısı
-- pgvector extension + ai_embeddings tablosu
--
-- Kapsam (son 6 ay):
--   - AI sohbet mesajları (ai_messages)
--   - Müşteri notları (customers.notes, business_records.notes)
--   - Tedavi protokol notları (treatment_protocols.notes, protocol_sessions.notes)
--
-- Embedding modeli: OpenAI text-embedding-3-small (1536 dimension)
-- Maliyet: $0.02 / 1M token — çok ucuz

-- pgvector extension (Supabase Pro'da zaten mevcut olabilir)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'ai_message',           -- AI sohbet mesajı
    'customer_note',        -- Müşteri profil notu
    'business_record',      -- Hasta dosyası (records)
    'protocol_note',        -- Tedavi protokol notu
    'protocol_session_note' -- Seans notu
  )),
  content_id UUID NOT NULL, -- Kaynak tablonun PK'sı
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE, -- Müşteri ile ilgili ise
  text TEXT NOT NULL, -- Embed edilen düz metin (arama sonrası gösterim için)
  embedding vector(1536) NOT NULL, -- OpenAI text-embedding-3-small
  metadata JSONB DEFAULT '{}'::jsonb, -- Ek bilgi (örn: tarih, hizmet adı, kategori)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Benzersiz (aynı içerik için tek kayıt)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_embeddings_unique
  ON ai_embeddings (business_id, content_type, content_id);

-- Business + customer filtresi (önce filtreleme, sonra vektör arama)
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_business
  ON ai_embeddings (business_id, content_type);

CREATE INDEX IF NOT EXISTS idx_ai_embeddings_customer
  ON ai_embeddings (business_id, customer_id)
  WHERE customer_id IS NOT NULL;

-- IVFFlat index cosine similarity için (10M satıra kadar iyi performans)
-- lists = sqrt(N), N = beklenen satır sayısı (~10K başlangıç için 100 yeterli)
CREATE INDEX IF NOT EXISTS idx_ai_embeddings_cosine
  ON ai_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS
ALTER TABLE ai_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_embeddings_select_own_business"
  ON ai_embeddings FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- Insert/update/delete sadece admin client (cron worker) — service role bypass eder
-- Normal kullanıcı direkt insert etmez

-- Yardımcı fonksiyon: benzerlik arama
-- Kullanım: SELECT * FROM search_embeddings('<biz_id>', '<vec>', 10, 'ai_message', '<customer_id>')
CREATE OR REPLACE FUNCTION search_embeddings(
  p_business_id UUID,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 10,
  p_content_type TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  content_id UUID,
  customer_id UUID,
  text TEXT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content_type,
    e.content_id,
    e.customer_id,
    e.text,
    e.metadata,
    1 - (e.embedding <=> p_query_embedding) AS similarity,
    e.created_at
  FROM ai_embeddings e
  WHERE e.business_id = p_business_id
    AND (p_content_type IS NULL OR e.content_type = p_content_type)
    AND (p_customer_id IS NULL OR e.customer_id = p_customer_id)
    AND (1 - (e.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

COMMENT ON TABLE ai_embeddings IS
  'AI anlamsal arama (RAG) için vektör deposu. OpenAI text-embedding-3-small (1536 dim). Son 6 ay kapsamı.';

COMMENT ON FUNCTION search_embeddings IS
  'İşletme içinde semantik arama yapar. Cosine similarity kullanır, IVFFlat index ile hızlandırılır.';
