import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt } from '@/lib/whatsapp/crypto'
import {
  exchangeCodeForToken,
  getWABAPhoneNumbers,
  subscribeToWebhooks,
} from '@/lib/whatsapp/meta-client'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const body = await request.json()
    const { code, businessId, wabaId, redirect_uri } = body

    if (!code || !businessId) {
      return NextResponse.json(
        { error: 'code ve businessId gerekli' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data: staff } = await admin
      .from('staff_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .in('role', ['owner', 'manager'])
      .single()

    if (!staff) {
      return NextResponse.json(
        { error: 'Bu işletme için yetkiniz yok' },
        { status: 403 },
      )
    }

    const { accessToken } = await exchangeCodeForToken(code, redirect_uri)

    let resolvedWabaId = wabaId
    if (!resolvedWabaId) {
      const debugRes = await fetch(
        `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
          },
        },
      )
      const debugData = await debugRes.json()
      const granularScopes = debugData.data?.granular_scopes || []
      const wabaScope = granularScopes.find(
        (s: any) => s.scope === 'whatsapp_business_management',
      )
      resolvedWabaId = wabaScope?.target_ids?.[0]

      if (!resolvedWabaId) {
        return NextResponse.json(
          { error: 'WABA ID bulunamadı. Lütfen tekrar deneyin.' },
          { status: 400 },
        )
      }
    }

    const phoneNumbers = await getWABAPhoneNumbers(resolvedWabaId, accessToken)
    if (!phoneNumbers.length) {
      return NextResponse.json(
        { error: 'Kayıtlı telefon numarası bulunamadı.' },
        { status: 400 },
      )
    }

    const phoneNumber = phoneNumbers[0]
    const encryptedToken = encrypt(accessToken)

    await subscribeToWebhooks(resolvedWabaId, accessToken)

    const { data: existing } = await admin
      .from('whatsapp_accounts')
      .select('id')
      .eq('business_id', businessId)
      .single()

    if (existing) {
      const { error: updateError } = await admin
        .from('whatsapp_accounts')
        .update({
          waba_id: resolvedWabaId,
          phone_number_id: phoneNumber.id,
          phone_number: phoneNumber.display_phone_number,
          display_name: phoneNumber.verified_name || null,
          access_token_encrypted: encryptedToken,
          status: 'active',
          quality_rating: phoneNumber.quality_rating || null,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('WhatsApp hesap güncelleme hatası:', updateError)
        return NextResponse.json(
          { error: 'Hesap güncelleme hatası', details: updateError.message, code: updateError.code },
          { status: 500 },
        )
      }
    } else {
      const { error: insertError } = await admin
        .from('whatsapp_accounts')
        .insert({
          business_id: businessId,
          waba_id: resolvedWabaId,
          phone_number_id: phoneNumber.id,
          phone_number: phoneNumber.display_phone_number,
          display_name: phoneNumber.verified_name || null,
          access_token_encrypted: encryptedToken,
          status: 'active',
          quality_rating: phoneNumber.quality_rating || null,
        })

      if (insertError) {
        console.error('WhatsApp hesap oluşturma hatası:', insertError)
        return NextResponse.json(
          { error: 'Hesap oluşturma hatası', details: insertError.message, code: insertError.code },
          { status: 500 },
        )
      }
    }

    await admin
      .from('businesses')
      .update({
        whatsapp_number: phoneNumber.display_phone_number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)

    return NextResponse.json({
      success: true,
      phoneNumber: phoneNumber.display_phone_number,
      displayName: phoneNumber.verified_name,
    })
  } catch (error: any) {
    console.error('WhatsApp bağlama hatası:', error)
    return NextResponse.json(
      { error: error.message || 'WhatsApp bağlama hatası' },
      { status: 500 },
    )
  }
}
