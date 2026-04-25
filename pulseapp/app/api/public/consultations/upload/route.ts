// app/api/public/consultations/upload/route.ts
// Geçici token ile fotoğraf yükleme. Auth gerektirmez — tempToken doğrulanır.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { verifyTempToken } from '@/lib/utils/temp-token'

const BUCKET_NAME = 'customer-photos'
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'])
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic', heif: 'image/heif',
  webp: 'image/webp',
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Geçersiz form verisi.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const tempToken = formData.get('tempToken') as string | null

  if (!file || !tempToken) {
    return NextResponse.json({ error: 'file ve tempToken zorunlu.' }, { status: 400 })
  }

  // Token doğrula
  const payload = verifyTempToken(tempToken)
  if (!payload) {
    return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş oturum. Lütfen formu yeniden başlatın.' }, { status: 401 })
  }

  const { businessId, customerId } = payload

  // Dosya doğrulama
  const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.has(fileExt)) {
    return NextResponse.json({ error: `Desteklenmeyen format: .${fileExt}. JPG, PNG, HEIC veya WebP kullanın.` }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Dosya boyutu 15MB limitini aşıyor.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Bucket'ın varlığını kontrol et / oluştur
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some(b => b.name === BUCKET_NAME)) {
    await supabase.storage.createBucket(BUCKET_NAME, { public: true, fileSizeLimit: MAX_FILE_SIZE })
  }

  const safeContentType = EXT_TO_MIME[fileExt] ?? 'application/octet-stream'
  const ts = Date.now()
  const uid = Math.random().toString(36).slice(2, 10)
  const path = `${businessId}/${customerId}/consultations/${ts}_${uid}.${fileExt}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, arrayBuffer, { contentType: safeContentType, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)

  return NextResponse.json({ url: publicUrl, path })
}
