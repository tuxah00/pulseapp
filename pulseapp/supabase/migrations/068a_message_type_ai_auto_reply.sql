-- T1.5 ek — message_type enum'a 'ai_auto_reply' değeri eklendi.
-- Auto-responder kod 'ai_auto_reply' MessageType kullanıyor ama DB enum'da yoktu;
-- bu eksikken production'da tüm otomatik yanıt insert'leri fail olurdu.
-- Ayrı migration çünkü ALTER TYPE ADD VALUE aynı transaction içinde kullanılamaz.

ALTER TYPE message_type ADD VALUE IF NOT EXISTS 'ai_auto_reply';
