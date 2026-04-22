import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-permission'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import OpenAI from 'openai'

export const POST = withAuth(async (req: NextRequest) => {
  const rl = checkRateLimit(req, RATE_LIMITS.ai)
  if (rl.limited) return rl.response

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Transkripsiyon servisi yapılandırılmamış' },
      { status: 503 }
    )
  }

  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as File | null

    if (!audio) {
      return NextResponse.json({ error: 'Ses dosyası bulunamadı' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'tr',
    })

    return NextResponse.json({ text: transcription.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
