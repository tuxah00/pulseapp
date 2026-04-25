'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Stethoscope, ChevronRight, ChevronLeft, Upload, X,
  CheckCircle2, AlertCircle, Loader2, Camera, Image as ImageIcon
} from 'lucide-react'
import { KvkkConsentForm } from '@/components/shared/kvkk-consent-form'
import { cn } from '@/lib/utils'

// ── Tipler ──
interface ServiceOption { id: string; name: string }
interface PhotoFile { file: File; preview: string; url?: string; path?: string; uploading?: boolean; error?: string }
interface BusinessInfo { name: string; sector: string; logo_url?: string | null }

const STEP_LABELS = ['Hizmet & Soru', 'Bilgileriniz & Fotoğraf', 'Onay & Gönder']

// ── Ana Sayfa ──
export default function ConsultationPage() {
  const { businessId } = useParams<{ businessId: string }>()

  const [step, setStep] = useState(1)
  const [biz, setBiz] = useState<BusinessInfo | null>(null)
  const [services, setServices] = useState<ServiceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Step 1
  const [serviceId, setServiceId] = useState('')
  const [serviceLabel, setServiceLabel] = useState('')
  const [question, setQuestion] = useState('')
  const [age, setAge] = useState('')

  // Step 2
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [healthNotes, setHealthNotes] = useState('')
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [tempToken, setTempToken] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [initError, setInitError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3
  const [kvkkConsented, setKvkkConsented] = useState(false)
  const [healthDataConsented, setHealthDataConsented] = useState(false)
  const [marketingConsented, setMarketingConsented] = useState(false)

  // Honeypot
  const [website, setWebsite] = useState('')

  // İşletme + hizmetleri yükle
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/public/business/${businessId}/info`)
        if (res.ok) {
          const d = await res.json()
          setBiz(d.data || d)
        }
        const svcRes = await fetch(`/api/public/business/${businessId}/services`)
        if (svcRes.ok) {
          const d = await svcRes.json()
          setServices((d.data || d || []).slice(0, 30))
        }
      } catch { /* yüklenemezse boş kalır */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [businessId])

  // ── Step 1 → 2 geçişi ──
  function goToStep2() {
    if (question.trim().length < 10) return
    setStep(2)
    window.scrollTo(0, 0)
  }

  // ── Init (Step 2'de ad/tel girilip fotoğraf seçilince) ──
  async function handleInit() {
    if (!fullName.trim() || !phone.trim()) return
    if (tempToken) return // zaten init edildi
    setInitError('')
    try {
      const res = await fetch('/api/public/consultations/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, fullName, phone, website }),
      })
      const d = await res.json()
      if (!res.ok) { setInitError(d.error || 'Hata oluştu.'); return }
      setTempToken(d.tempToken)
      setCustomerId(d.customerId)
    } catch { setInitError('Bağlantı hatası.') }
  }

  // ── Fotoğraf seçimi ──
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (photos.length + files.length > 5) {
      alert('En fazla 5 fotoğraf yükleyebilirsiniz.')
      return
    }

    // Init edilmemişse önce init et
    let token = tempToken
    if (!token) {
      if (!fullName.trim() || !phone.trim()) {
        setInitError('Fotoğraf yüklemeden önce lütfen adınızı ve telefonunuzu girin.')
        return
      }
      await handleInit()
      token = tempToken
      // handleInit async state update — bekle
      await new Promise(r => setTimeout(r, 100))
      token = tempToken
    }

    for (const file of files) {
      const preview = URL.createObjectURL(file)
      const newPhoto: PhotoFile = { file, preview, uploading: true }
      setPhotos(prev => [...prev, newPhoto])

      // Upload
      const form = new FormData()
      form.append('file', file)
      form.append('tempToken', token)

      try {
        const res = await fetch('/api/public/consultations/upload', { method: 'POST', body: form })
        const d = await res.json()
        if (!res.ok) {
          setPhotos(prev => prev.map(p => p.preview === preview ? { ...p, uploading: false, error: d.error } : p))
        } else {
          setPhotos(prev => prev.map(p => p.preview === preview ? { ...p, uploading: false, url: d.url, path: d.path } : p))
        }
      } catch {
        setPhotos(prev => prev.map(p => p.preview === preview ? { ...p, uploading: false, error: 'Yükleme başarısız.' } : p))
      }
    }

    // Input'u sıfırla (aynı dosyayı tekrar seçmeye izin ver)
    e.target.value = ''
  }

  function removePhoto(preview: string) {
    setPhotos(prev => prev.filter(p => p.preview !== preview))
  }

  // ── KVKK callback ──
  function handleConsent(types: string[]) {
    setKvkkConsented(types.includes('kvkk'))
    setHealthDataConsented(types.includes('health_data'))
    setMarketingConsented(types.includes('marketing'))
  }

  // ── Final Submit ──
  async function handleSubmit() {
    if (!kvkkConsented || !healthDataConsented) return
    if (!tempToken) { setSubmitError('Oturum süresi dolmuş. Lütfen sayfayı yenileyin.'); return }

    const uploadedPhotos = photos.filter(p => p.url && p.path).map(p => ({ url: p.url!, path: p.path! }))
    const pendingPhotos = photos.filter(p => p.uploading)
    if (pendingPhotos.length > 0) { setSubmitError('Lütfen fotoğraf yüklemenin tamamlanmasını bekleyin.'); return }

    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch('/api/public/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken,
          businessId,
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          age: age ? parseInt(age) : null,
          serviceId: serviceId || null,
          serviceLabel: serviceLabel.trim() || null,
          question: question.trim(),
          healthNotes: healthNotes.trim() || null,
          photoUrls: uploadedPhotos,
          consents: { kvkk: kvkkConsented, healthData: healthDataConsented, marketing: marketingConsented },
          website,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setSubmitError(d.error || 'Gönderim başarısız.'); return }
      setSubmitted(true)
      window.scrollTo(0, 0)
    } catch { setSubmitError('Bağlantı hatası. Lütfen tekrar deneyin.') }
    finally { setSubmitting(false) }
  }

  // ── Doğrulama ──
  const step1Valid = question.trim().length >= 10
  const step2Valid = fullName.trim().length >= 2 && phone.trim().length >= 7
  const step3Valid = kvkkConsented && healthDataConsented
  const hasUploadingPhotos = photos.some(p => p.uploading)

  // ── Loading ──
  if (loading) {
    return (
      <div className="consultation-page min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-pulse-900 animate-spin" />
      </div>
    )
  }

  // ── Başarı ekranı ──
  if (submitted) {
    return (
      <div className="consultation-page min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Talebiniz Alındı!</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Ön konsültasyon talebiniz başarıyla iletildi. Ekibimiz en kısa sürede sizinle iletişime geçecektir.
          </p>
          {biz && (
            <p className="text-xs text-gray-400">{biz.name}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="consultation-page min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-pulse-900 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ön Konsültasyon</p>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">{biz?.name || 'Klinik'}</h1>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="flex items-center gap-1">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1
              const active = step === n
              const done = step > n
              return (
                <div key={n} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className={cn(
                    'h-1.5 rounded-full flex-1 transition-all',
                    done ? 'bg-pulse-900' : active ? 'bg-pulse-900/60' : 'bg-gray-200'
                  )} />
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Adım {step} / {STEP_LABELS.length} — {STEP_LABELS[step - 1]}
          </p>
        </div>
      </div>

      {/* Honeypot — bot koruması */}
      <input
        name="website"
        type="text"
        value={website}
        onChange={e => setWebsite(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        autoComplete="off"
      />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── STEP 1 — Hizmet & Soru ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Değerlendirme Talebiniz</h2>

              {/* Hizmet Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  İlgilendiğiniz hizmet <span className="text-gray-400 font-normal">(opsiyonel)</span>
                </label>
                {services.length > 0 ? (
                  <select
                    value={serviceId}
                    onChange={e => { setServiceId(e.target.value); setServiceLabel('') }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
                  >
                    <option value="">Seçiniz...</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="other">Listede yok, aşağıda yazacağım</option>
                  </select>
                ) : null}

                {(!services.length || serviceId === 'other') && (
                  <input
                    type="text"
                    value={serviceLabel}
                    onChange={e => setServiceLabel(e.target.value)}
                    placeholder="Hizmet adını yazın (ör: Botoks, İmplant...)"
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
                  />
                )}
              </div>

              {/* Yaş */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Yaşınız <span className="text-gray-400 font-normal">(opsiyonel)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="ör: 32"
                  className="w-32 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
                />
              </div>

              {/* Soru / Şikayet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Sorunuz / Şikayetiniz <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  rows={5}
                  maxLength={3000}
                  placeholder="Şikayetinizi ve beklentilerinizi ayrıntılı olarak açıklayın. Örn: 'Burnumun üst kısmındaki tümsek beni rahatsız ediyor, estetik operasyon için uygun muyum?'"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{question.length}/3000 karakter (en az 10)</p>
              </div>
            </div>

            <button
              onClick={goToStep2}
              disabled={!step1Valid}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all',
                step1Valid
                  ? 'bg-pulse-900 text-white hover:bg-pulse-800'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              Devam Et <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── STEP 2 — Bilgileriniz & Fotoğraflar ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Kişisel Bilgileriniz</h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Ad Soyad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    onBlur={handleInit}
                    placeholder="Adınızı ve soyadınızı girin"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Telefon <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onBlur={handleInit}
                    placeholder="05XX XXX XX XX"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    E-posta <span className="text-gray-400 font-normal">(opsiyonel)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
                  />
                </div>
              </div>

              {/* Sağlık Notları */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Sağlık Notları <span className="text-gray-400 font-normal">(opsiyonel)</span>
                </label>
                <textarea
                  value={healthNotes}
                  onChange={e => setHealthNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Alerji, düzenli kullandığınız ilaçlar, kronik hastalıklar... (varsa belirtin)"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900 resize-none"
                />
              </div>
            </div>

            {/* Fotoğraf Upload */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Fotoğraflar</h2>
                <span className="text-xs text-gray-400">{photos.length}/5</span>
              </div>
              <p className="text-xs text-gray-500">Şikayetinizle ilgili fotoğraf ekleyebilirsiniz (opsiyonel). JPG, PNG, HEIC, WebP — max 15MB</p>

              {initError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600">{initError}</p>
                </div>
              )}

              {/* Fotoğraf önizlemeleri */}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map(photo => (
                    <div key={photo.preview} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.preview} alt="" className="h-full w-full object-cover" />
                      {photo.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 text-white animate-spin" />
                        </div>
                      )}
                      {photo.error && (
                        <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center p-1">
                          <p className="text-white text-[10px] text-center leading-tight">{photo.error}</p>
                        </div>
                      )}
                      {!photo.uploading && (
                        <button
                          onClick={() => removePhoto(photo.preview)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload butonu */}
              {photos.length < 5 && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!step2Valid}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 text-sm font-medium transition-all',
                      step2Valid
                        ? 'border-gray-200 text-gray-500 hover:border-pulse-900/40 hover:text-pulse-900 hover:bg-pulse-900/5 cursor-pointer'
                        : 'border-gray-100 text-gray-300 cursor-not-allowed'
                    )}
                  >
                    <Camera className="h-4 w-4" />
                    Fotoğraf Ekle (Kamera veya Galeri)
                  </button>
                  {!step2Valid && (
                    <p className="text-[11px] text-gray-400 text-center mt-1">Fotoğraf eklemek için ad ve telefon bilgilerini girin</p>
                  )}
                </div>
              )}
            </div>

            {/* Navigasyon */}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep(1); window.scrollTo(0, 0) }}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
              >
                <ChevronLeft className="h-4 w-4" /> Geri
              </button>
              <button
                onClick={() => { setStep(3); window.scrollTo(0, 0) }}
                disabled={!step2Valid || hasUploadingPhotos}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all',
                  step2Valid && !hasUploadingPhotos
                    ? 'bg-pulse-900 text-white hover:bg-pulse-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                {hasUploadingPhotos ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Fotoğraflar Yükleniyor...</>
                ) : (
                  <>Devam Et <ChevronRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Onay & Gönder ── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Özet */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <h2 className="text-base font-semibold text-gray-900">Talebinizin Özeti</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ad Soyad</span>
                  <span className="font-medium text-gray-900">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Telefon</span>
                  <span className="font-medium text-gray-900">{phone}</span>
                </div>
                {(serviceId || serviceLabel) && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hizmet</span>
                    <span className="font-medium text-gray-900">
                      {serviceId !== 'other' ? services.find(s => s.id === serviceId)?.name : serviceLabel}
                    </span>
                  </div>
                )}
                {age && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Yaş</span>
                    <span className="font-medium text-gray-900">{age}</span>
                  </div>
                )}
                <div className="flex justify-between items-start gap-4">
                  <span className="text-gray-500 flex-shrink-0">Soru</span>
                  <span className="font-medium text-gray-900 text-right line-clamp-3">{question}</span>
                </div>
                {photos.filter(p => p.url).length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fotoğraflar</span>
                    <span className="font-medium text-gray-900">{photos.filter(p => p.url).length} adet</span>
                  </div>
                )}
              </div>
            </div>

            {/* KVKK */}
            <KvkkConsentForm
              businessName={biz?.name}
              onConsent={handleConsent}
              required={true}
              showHealthData={true}
              showMarketing={true}
            />

            {/* Hata */}
            {submitError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}

            {/* Navigasyon */}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep(2); window.scrollTo(0, 0) }}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
              >
                <ChevronLeft className="h-4 w-4" /> Geri
              </button>
              <button
                onClick={handleSubmit}
                disabled={!step3Valid || submitting}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all',
                  step3Valid && !submitting
                    ? 'bg-pulse-900 text-white hover:bg-pulse-800'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</>
                ) : (
                  'Talebi Gönder'
                )}
              </button>
            </div>

            {(!kvkkConsented || !healthDataConsented) && (
              <p className="text-xs text-center text-gray-400">
                Talebi göndermek için KVKK ve sağlık verisi onayları zorunludur.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
