-- AI asistan üzerinden oluşturulan randevuları ayırt edebilmek için
-- appointment_source enum'una 'ai_assistant' değeri eklenir.

ALTER TYPE appointment_source ADD VALUE IF NOT EXISTS 'ai_assistant';
