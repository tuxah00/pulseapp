'use client'

import { HelpCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { VALUE_METHOD_DESCRIPTIONS } from '@/lib/analytics/pulse-value-methods'

type MethodKey = keyof typeof VALUE_METHOD_DESCRIPTIONS

interface ValueMethodPopupProps {
  methodKey: MethodKey
  detail?: string
}

export function ValueMethodPopup({ methodKey, detail }: ValueMethodPopupProps) {
  const method = VALUE_METHOD_DESCRIPTIONS[methodKey]

  if (!method) return null

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Nasıl hesaplandı?"
            className="inline-flex items-center justify-center rounded-full text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-400 transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-pulse-900 dark:text-pulse-400">
            {method.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-gray-700 dark:text-gray-300">{method.summary}</p>

          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1.5">Nasıl hesaplanır?</p>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              {method.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-pulse-900 dark:text-pulse-400">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {method.assumption && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                <span className="font-medium">Varsayım:</span> {method.assumption}
              </p>
            </div>
          )}

          {detail && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
              <p className="text-xs text-gray-700 dark:text-gray-300 font-mono">{detail}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
