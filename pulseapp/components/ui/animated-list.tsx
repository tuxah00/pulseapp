'use client'

import { motion, AnimatePresence } from 'framer-motion'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
}

export function AnimatedList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className={className}>
      <AnimatePresence>{children}</AnimatePresence>
    </motion.div>
  )
}

export function AnimatedItem({ children, className, ...props }: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div variants={itemVariants} {...props} className={className}>
      {children}
    </motion.div>
  )
}
