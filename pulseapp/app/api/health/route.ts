import { NextResponse } from 'next/server'

// Coolify / Docker health check endpoint'i
// Uptime izleyicileri de (UptimeRobot, Better Stack vb.) bu URL'i poll edebilir.
// Auth YOK — public bilinçli olarak (yalnızca ayakta mı kontrolü).
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
