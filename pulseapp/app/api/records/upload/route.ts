import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET_NAME = 'records-files'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif',
  'doc', 'docx', 'xls', 'xlsx',
  'dcm', 'tiff', 'tif', 'bmp', 'webp', 'gif', 'svg',
])

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const businessId = formData.get('businessId') as string | null
  const recordId = formData.get('recordId') as string | null

  if (!file || !businessId || !recordId) {
    return NextResponse.json({ error: 'file, businessId and recordId are required' }, { status: 400 })
  }

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

  // Dosyayı yükle
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${businessId}/${recordId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, arrayBuffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)
  return NextResponse.json({
    url: urlData.publicUrl,
    metadata: {
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    },
  })
}
