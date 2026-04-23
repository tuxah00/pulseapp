'use client'

import { motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import type { TutorialTopic } from '@/lib/ai/tutorial-content'

interface Props {
  topic: TutorialTopic
  onOpen: () => void
  onDismiss: () => void
}

/**
 * Asistan butonunun üstünde beliren küçük balon —
 * "Bu sayfa hakkında ipucu ister misin?" davetiyesi.
 * Panel kapalıyken görünür, tıklanınca paneli açar + tutorial akışını tetikler.
 */
export default function TutorialBubble({ topic, onOpen, onDismiss }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="fixed bottom-24 right-6 z-[54] max-w-[260px]"
    >
      <div className="relative rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 p-3 pr-8">
        <button
          onClick={onDismiss}
          className="absolute top-1.5 right-1.5 p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Bu sayfada gizle"
        >
          <X className="w-3 h-3" />
        </button>
        <button
          onClick={onOpen}
          className="flex items-start gap-2 text-left w-full group"
        >
          <div className="w-7 h-7 rounded-lg bg-pulse-900 flex items-center justify-center text-white flex-shrink-0 ring-1 ring-pulse-900/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {topic.title} sayfası
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug group-hover:text-pulse-900 dark:group-hover:text-pulse-300 transition-colors">
              Kısa bir ipucu ister misin?
            </p>
          </div>
        </button>
        {/* Oluşan kuyruk (arrow) */}
        <div
          aria-hidden
          className="absolute -bottom-1.5 right-8 w-3 h-3 rotate-45 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700"
        />
      </div>
    </motion.div>
  )
}
