'use client'

import { Bot } from 'lucide-react'
import { motion } from 'framer-motion'

interface Props {
  onClick: () => void
}

export default function AIAssistantButton({ onClick }: Props) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[55] w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl flex items-center justify-center group"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      title="AI Asistan (Ctrl+Shift+A)"
    >
      <Bot className="w-6 h-6 group-hover:scale-110 transition-transform" />
    </motion.button>
  )
}
