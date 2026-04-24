'use client'

import { useMemo } from 'react'
import { CheckCircle2, Sparkles } from 'lucide-react'

/**
 * Sihirbaz tamamlama ekranı.
 *
 * CSS confetti burst + özet kart. Dış kütüphane kullanılmadı — keyframe'ler
 * globals.css'te `confettiFall` + `confettiRise` olarak tanımlı.
 */

interface CompletionSummary {
  services: number
  packages: number
  workflows: number
  rewards: number
  campaigns: number
}

interface CompletionStepProps {
  summary: CompletionSummary
  onFinish: () => void
  finishLoading?: boolean
}

const PALETTE = ['#193d8f', '#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444']

export default function CompletionStep({ summary, onFinish, finishLoading }: CompletionStepProps) {
  // Confetti parçacıkları — sabit tutulmalı (her render'da yeniden üretilmemeli)
  const confetti = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.5 + Math.random() * 2,
      color: PALETTE[i % PALETTE.length],
      size: 6 + Math.floor(Math.random() * 6),
      rotate: Math.random() * 360,
    }))
  }, [])

  const items: Array<{ label: string; count: number }> = [
    { label: 'hizmet', count: summary.services },
    { label: 'paket', count: summary.packages },
    { label: 'otomatik mesaj', count: summary.workflows },
    { label: 'ödül şablonu', count: summary.rewards },
    { label: 'taslak kampanya', count: summary.campaigns },
  ].filter(i => i.count > 0)

  return (
    <div className="relative flex min-h-[60vh] items-center justify-center">
      {/* Confetti katmanı */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {confetti.map(p => (
          <span
            key={p.id}
            className="absolute top-[-20px] block animate-wizard-confetti"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              transform: `rotate(${p.rotate}deg)`,
              borderRadius: p.id % 3 === 0 ? '50%' : '2px',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl animate-wizard-finish">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 size={36} strokeWidth={2.2} />
        </div>
        <h2 className="mt-5 text-3xl font-bold text-pulse-900 sm:text-4xl">Kurulumunuz tamamlandı</h2>
        <p className="mt-2 text-gray-600">
          Sisteminiz ilk müşteriyi karşılamaya hazır.
        </p>

        {items.length > 0 && (
          <div className="mt-6 space-y-2 rounded-2xl bg-gray-50 p-5 text-left">
            <p className="flex items-center gap-2 text-sm font-semibold text-pulse-900">
              <Sparkles size={16} />
              Kuruluma eklendi
            </p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {items.map(i => (
                <li key={i.label} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-pulse-900" />
                  <span className="font-semibold">{i.count}</span>
                  <span>{i.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onFinish}
          disabled={finishLoading}
          className="mt-6 w-full cursor-pointer rounded-xl bg-pulse-900 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-pulse-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {finishLoading ? 'Açılıyor…' : "Dashboard'a git"}
        </button>
      </div>
    </div>
  )
}
