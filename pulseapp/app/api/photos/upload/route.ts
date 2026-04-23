import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: Supabase Storage bucket auto-create + yazma (storage RLS ayrı politikalar, auth wrapper üzerinden yetki kontrolü zaten yapıldı)
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWritePermission } from '@/lib/api/with-permission'

/**
 * Müşteri fotoğraflarının Supabase Storage'a yüklendiği endpoint.
 * `records/upload` ile aynı pattern: uzantıdan MIME türetilir, client file.type'a güvenilmez.
 */

const BUCKET_NAME = 'customer-photos'
const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB (fotoğraf için yeterli, 50MB records'ta)

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp',
])

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic', heif: 'image/heif',
  webp: 'image/webp',
}

export async function POST(req: NextRequest) {
  const auth = await requireWritePermission(req, 'customers')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const customerId = formData.get('customerId') as string | null

  if (!file || !customerId) {
    return NextResponse.json({ error: 'file ve customerId zorunlu' }, { status: 400 })
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.has(fileExt)) {
    return NextResponse.json({ error: `Desteklenmeyen dosya formatı: .${fileExt}` }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Dosya boyutu 15MB limitini aşıyor' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Müşterinin bu işletmeye ait olduğunu doğrula (cross-tenant koruma)
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
  }

  // Bucket yoksa oluştur
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME)

  if (!bucketExists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
    })
    if (createError && !createError.message.includes('already exists')) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
  }

  const safeContentType = EXT_TO_MIME[fileExt] ?? 'application/octet-stream'
  const path = `${businessId}/${customerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, arrayBuffer, { contentType: safeContentType })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)
  return NextResponse.json({
    url: urlData.publicUrl,
    path,
  })
}
