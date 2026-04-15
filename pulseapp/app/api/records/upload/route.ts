import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'

const BUCKET_NAME = 'records-files'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
// SVG kabul edilmez — embedded <script> ile stored XSS yolu
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif',
  'doc', 'docx', 'xls', 'xlsx',
  'dcm', 'tiff', 'tif', 'bmp', 'webp', 'gif',
])

// Uzantıdan güvenilir content-type türet (client-tarafı `file.type`'a güvenme)
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic', heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  dcm: 'application/dicom',
  tiff: 'image/tiff', tif: 'image/tiff',
  bmp: 'image/bmp',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'records')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const recordId = formData.get('recordId') as string | null

  if (!file || !recordId) {
    return NextResponse.json({ error: 'file and recordId are required' }, { status: 400 })
  }

  // recordId'nin bu işletmeye ait olduğunu doğrula (cross-tenant koruma)
  const supabaseAuth = createServerSupabaseClient()
  const { data: record } = await supabaseAuth
    .from('business_records')
    .select('id')
    .eq('id', recordId)
    .eq('business_id', businessId)
    .single()

  if (!record) {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
  }

  const supabase = createAdminClient()

  // Dosya tipi kontrolü
  const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.has(fileExt)) {
    return NextResponse.json({ error: `Desteklenmeyen dosya formatı: .${fileExt}` }, { status: 400 })
  }

  // Dosya boyutu kontrolü
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Dosya boyutu 50MB limitini aşıyor' }, { status: 400 })
  }

  // Bucket yoksa oluştur
  const { data: buckets } = await supabase.storage.listBuckets()
  const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME)

  if (!bucketExists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    })
    if (createError && !createError.message.includes('already exists')) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
  }

  // Content-type uzantıdan türetilir — `file.type` client-kontrollü olduğu için güvenilmez
  const safeContentType = EXT_TO_MIME[fileExt] ?? 'application/octet-stream'
  const path = `${businessId}/${recordId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

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
    metadata: {
      name: file.name,
      size: file.size,
      type: safeContentType,
      uploadedAt: new Date().toISOString(),
    },
  })
}
