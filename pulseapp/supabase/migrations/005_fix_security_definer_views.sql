-- Migration: 005_fix_security_definer_views
-- SECURITY DEFINER view'ları security_invoker=true olarak günceller.
-- SECURITY DEFINER view'lar RLS policy'lerini bypass ederek veri sızıntısına
-- yol açabilir. security_invoker=true ile view, sorguyu çalıştıran kullanıcının
-- RLS kurallarına tabi olur.

ALTER VIEW public.business_stats SET (security_invoker = true);
ALTER VIEW public.today_appointments SET (security_invoker = true);
