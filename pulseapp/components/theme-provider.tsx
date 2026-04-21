'use client'

import { useEffect } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'

function ThemeSyncProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useNextTheme()
  const supabase = createClient()

  // On mount: sync theme from Supabase user_metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const accountTheme = data?.user?.user_metadata?.theme as string | undefined
      if (accountTheme && (accountTheme === 'light' || accountTheme === 'dark')) {
        setTheme(accountTheme)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On theme change: persist to Supabase (non-blocking)
  useEffect(() => {
    if (!resolvedTheme) return
    supabase.auth.updateUser({ data: { theme: resolvedTheme } }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme])

  return <>{children}</>
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="theme"
    >
      <ThemeSyncProvider>{children}</ThemeSyncProvider>
    </NextThemesProvider>
  )
}

// Backward-compatible useTheme hook — keeps same { theme, toggleTheme } interface
export function useTheme() {
  const { resolvedTheme, setTheme } = useNextTheme()

  const theme = (resolvedTheme === 'dark' ? 'dark' : 'light') as 'light' | 'dark'

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return { theme, toggleTheme }
}
