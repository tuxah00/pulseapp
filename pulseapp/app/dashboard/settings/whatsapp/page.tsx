'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Script from 'next/script'
import { useSearchParams } from 'next/navigation'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Loader2,
  MessageCircle,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Zap,
  Bell,
  Bot,
  Unplug,
  RefreshCw,
} from 'lucide-react'

declare global {
  interface Window {
    FB: any
    fbAsyncInit: () => void
  }
}

interface WhatsAppStatus {
  connected: boolean
  account: {
    id: string
    phoneNumber: string
    displayName: string | null
    status: string
    qualityRating: string | null
    messagingLimit: string | null
    connectedAt: string
  } | null
}

export default function WhatsAppSettingsPage() {
  const searchParams = useSearchParams()
  const { businessId, loading: ctxLoading } = useBusinessContext()

  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fbReady, setFbReady] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID

  const fetchStatus = useCallback(async () => {
    if (!businessId) return
    try {
      const res = await fetch(`/api/whatsapp/status?businessId=${businessId}`)
      const data = await res.json()
      setStatus(data)
    } catch {
      setError('Durum bilgisi alınamadı.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading && businessId) fetchStatus()
  }, [fetchStatus, ctxLoading, businessId])

  // Callback'ten dönüşte URL'deki success/error
  useEffect(() => {
    const successMsg = searchParams.get('success')
    const errorMsg = searchParams.get('error')
    if (successMsg) setSuccess(decodeURIComponent(successMsg))
    if (errorMsg) setError(decodeURIComponent(errorMsg))
  }, [searchParams])

  function handleFBInit() {
    if (window.FB) {
      window.FB.init({
        appId: metaAppId,
        cookie: true,
        xfbml: true,
        version: 'v21.0',
      })
      setFbReady(true)
    }
  }

  useEffect(() => {
    window.fbAsyncInit = handleFBInit
    if (window.FB) handleFBInit()
  }, [metaAppId])

  async function handleConnect() {
    if (!metaAppId) {
      setError('Meta App ID yapılandırılmamış. Vercel ortam değişkenlerinde NEXT_PUBLIC_META_APP_ID tanımlı olmalı.')
      return
    }
    if (!window.FB || !fbReady) {
      setError('Facebook SDK yüklenemedi. Sayfayı yenileyin veya açılır pencerelere izin verin.')
      return
    }

    setError(null)
    setSuccess(null)
    setConnecting(true)

    const timeoutMs = 90_000
    connectTimeoutRef.current = setTimeout(() => {
      connectTimeoutRef.current = null
      setConnecting(false)
      setError(
        'Bağlantı zaman aşımına uğradı. Açılır pencere engelliyse izin verin, giriş penceresini tamamlayın veya sayfayı yenileyip tekrar deneyin.'
      )
    }, timeoutMs)

    window.FB.login(
      async (response: any) => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current)
          connectTimeoutRef.current = null
        }
        if (response.authResponse?.code) {
          try {
            const res = await fetch('/api/whatsapp/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: response.authResponse.code,
                businessId,
              }),
            })
            const data = await res.json()

            if (data.success) {
              setSuccess(`WhatsApp bağlantısı başarılı! Numara: ${data.phoneNumber}`)
              await fetchStatus()
            } else {
              setError(data.error || 'Bağlantı sırasında hata oluştu.')
            }
          } catch {
            setError('Bağlantı isteği başarısız.')
          }
        } else {
          setError('Facebook girişi iptal edildi veya pencerede giriş tamamlanmadı.')
        }
        setConnecting(false)
      },
      {
        display: 'popup',
        config_id: metaAppId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      },
    )
  }

  function handleCancelConnect() {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
    setConnecting(false)
    setError(null)
  }

  /** Popup açılmıyorsa: aynı sayfada Facebook'a yönlendir, giriş sonrası callback'e döner. config_id yerine scope kullan (Meta Embedded Signup config zorunlu değil). */
  function handleConnectWithRedirect() {
    if (!metaAppId || !businessId) {
      setError('Meta App ID veya işletme bilgisi eksik.')
      return
    }
    setError(null)
    const redirectUri = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/settings/whatsapp/callback`
    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth')
    url.searchParams.set('client_id', metaAppId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'whatsapp_business_management,business_management')
    url.searchParams.set('state', businessId)
    window.location.href = url.toString()
  }

  async function handleDisconnect() {
    setError(null)
    setSuccess(null)
    setDisconnecting(true)

    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })
      const data = await res.json()

      if (data.success) {
        setSuccess('WhatsApp bağlantısı kaldırıldı.')
        setShowDisconnectConfirm(false)
        await fetchStatus()
      } else {
        setError(data.error || 'Bağlantı kaldırma hatası.')
      }
    } catch {
      setError('Bağlantı kaldırma isteği başarısız.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading || ctxLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
      </div>
    )
  }

  const isConnected = status?.connected === true
  const account = status?.account

  return (
    <div>
      <Script
        src="https://connect.facebook.net/tr_TR/sdk.js"
        strategy="afterInteractive"
        onLoad={handleFBInit}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Entegrasyonu</h1>
        <p className="mt-1 text-sm text-gray-500">
          İşletmenizin WhatsApp Business hesabını bağlayarak müşterilerinize
          kendi numaranızdan mesaj gönderin.
        </p>
      </div>

      {success && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {isConnected && account ? (
        <div className="space-y-6">
          {/* Bağlantı Durumu Kartı */}
          <div className="card border-green-200 bg-gradient-to-br from-green-50/50 to-white dark:from-gray-800 dark:to-gray-800 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                  <MessageCircle className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">WhatsApp Bağlı</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Aktif
                    </span>
                  </div>
                  {account.displayName && (
                    <p className="text-sm text-gray-600 mt-0.5">{account.displayName}</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => fetchStatus()}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Durumu yenile"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-700 border border-slate-600 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-300 mb-1">
                  <Phone className="h-3.5 w-3.5" />
                  Telefon Numarası
                </div>
                <p className="font-semibold text-white">{account.phoneNumber}</p>
              </div>

              <div className="rounded-lg bg-slate-700 border border-slate-600 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-300 mb-1">
                  <Shield className="h-3.5 w-3.5" />
                  Kalite Puanı
                </div>
                <QualityBadge rating={account.qualityRating} />
              </div>

              <div className="rounded-lg bg-slate-700 border border-slate-600 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-300 mb-1">
                  <Zap className="h-3.5 w-3.5" />
                  Bağlanma Tarihi
                </div>
                <p className="font-semibold text-white">
                  {new Date(account.connectedAt).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Özellikler Bilgisi */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Aktif Özellikler</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FeatureItem
                icon={<MessageCircle className="h-4 w-4" />}
                title="Müşteri Mesajları"
                description="Kendi numaranızdan WhatsApp mesajı gönderin ve alın"
              />
              <FeatureItem
                icon={<Bell className="h-4 w-4" />}
                title="Randevu Hatırlatmaları"
                description="Otomatik 24 saat ve 2 saat öncesi hatırlatmalar"
              />
              <FeatureItem
                icon={<Bot className="h-4 w-4" />}
                title="AI Otomatik Yanıt"
                description="Gelen mesajları AI ile sınıflandırma ve yanıtlama"
              />
              <FeatureItem
                icon={<Shield className="h-4 w-4" />}
                title="Güvenli Bağlantı"
                description="Uçtan uca şifrelenmiş ve güvenli API bağlantısı"
              />
            </div>
          </div>

          {/* Bağlantıyı Kes */}
          <div className="card border-red-100">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Bağlantıyı Kes</h3>
                <p className="text-sm text-gray-500 mt-1">
                  WhatsApp bağlantısını kaldırdığınızda mesaj gönderme ve alma özelliği devre dışı kalır.
                </p>
              </div>
              {!showDisconnectConfirm ? (
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Unplug className="h-4 w-4" />
                  Bağlantıyı Kes
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {disconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Evet, Kes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bağlantı Yok - Ana Kart */}
          <div className="card border-pulse-200 bg-gradient-to-br from-pulse-50/30 to-white dark:from-gray-800 dark:to-gray-800 dark:border-gray-700">
            <div className="text-center py-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                <MessageCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                WhatsApp Business Hesabınızı Bağlayın
              </h2>
              <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                İşletmenizin WhatsApp numarasını PulseApp&apos;a bağlayarak
                müşterilerinize kendi numaranızdan otomatik mesajlar gönderin.
              </p>

              {/* Önce redirect seçeneği - popup açılmıyorsa kullan */}
              <div className="mt-6 w-full max-w-md mx-auto rounded-xl border-2 border-green-500 bg-green-50/80 p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">Aynı sekmede bağlan (önerilen)</p>
                <p className="text-xs text-green-700 mb-3">Facebook penceresi açılmıyorsa bu yöntemi kullanın.</p>
                <button
                  type="button"
                  onClick={handleConnectWithRedirect}
                  disabled={connecting || !metaAppId}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp’ı buradan bağla (aynı sekme)
                </button>
              </div>

              <p className="mt-4 text-xs text-gray-500">veya popup ile:</p>
              <div className="mt-2 flex flex-col items-center gap-3">
                <button
                  onClick={handleConnect}
                  disabled={connecting || !metaAppId}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <MessageCircle className="h-5 w-5" />
                  )}
                  {connecting ? 'Bağlanıyor...' : 'WhatsApp\'ı Bağla (popup)'}
                </button>
                {connecting && (
                  <button
                    type="button"
                    onClick={handleCancelConnect}
                    className="text-sm text-gray-500 underline hover:text-gray-700"
                  >
                    İptal
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Tıklayınca Facebook/Meta giriş penceresi açılır. Takılı kalırsa &quot;İptal&quot;e basıp tekrar deneyin.
              </p>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-left text-xs text-amber-800">
                <p className="font-medium">Pencere hiç açılmıyorsa:</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li><strong>Yeşil &quot;Buradan giriş yapın&quot;</strong> linkine tıklayın — aynı sekmede Facebook’a gider, giriş sonrası buraya döner.</li>
                  <li>Meta’da <strong>Valid OAuth Redirect URIs</strong> listesine bu adresi ekleyin: <code className="rounded bg-amber-100 px-1 break-all">{typeof window !== 'undefined' ? `${window.location.origin}/dashboard/settings/whatsapp/callback` : 'https://.../dashboard/settings/whatsapp/callback'}</code></li>
                  <li>Vercel’de <strong>NEXT_PUBLIC_META_APP_ID</strong> tanımlı olmalı.</li>
                </ul>
              </div>

              {!metaAppId && (
                <p className="mt-3 text-xs text-amber-600">
                  Meta App ID yapılandırılmamış. Vercel’de NEXT_PUBLIC_META_APP_ID ekleyin.
                </p>
              )}
            </div>
          </div>

          {/* Faydalar */}
          <div className="grid gap-4 sm:grid-cols-2">
            <BenefitCard
              icon={<MessageCircle className="h-5 w-5 text-green-600" />}
              title="Kendi Numaranızdan Mesaj"
              description="Müşterilerinize işletmenizin WhatsApp numarasından mesaj gönderin ve alın."
            />
            <BenefitCard
              icon={<Bell className="h-5 w-5 text-blue-600" />}
              title="Otomatik Hatırlatmalar"
              description="Randevu hatırlatmaları otomatik olarak WhatsApp'tan gönderilir."
            />
            <BenefitCard
              icon={<Bot className="h-5 w-5 text-purple-600" />}
              title="AI Destekli Yanıtlar"
              description="Gelen mesajlar AI ile sınıflandırılır ve otomatik yanıt önerileri oluşturulur."
            />
            <BenefitCard
              icon={<Shield className="h-5 w-5 text-amber-600" />}
              title="Güvenli ve Resmi"
              description="Meta'nın resmi WhatsApp Business API'si ile güvenli ve doğrulanmış mesajlaşma."
            />
          </div>

          {/* Gereksinimler */}
          <div className="card dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Gereksinimler
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                Facebook / Meta Business hesabı
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                Doğrulanmış bir telefon numarası (WhatsApp Business için kullanılacak)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                Numaranın halihazırda başka bir WhatsApp Business hesabında kayıtlı olmaması
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function QualityBadge({ rating }: { rating: string | null }) {
  if (!rating) {
    return <p className="font-semibold text-gray-400">Bilinmiyor</p>
  }

  const config: Record<string, { color: string; label: string }> = {
    GREEN: { color: 'text-green-600', label: 'Yüksek' },
    YELLOW: { color: 'text-amber-600', label: 'Orta' },
    RED: { color: 'text-red-600', label: 'Düşük' },
  }

  const { color, label } = config[rating] || { color: 'text-gray-600', label: rating }

  return <p className={`font-semibold ${color}`}>{label}</p>
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-600 bg-slate-700 p-3">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-slate-200 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-300 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </div>
  )
}
