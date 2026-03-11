'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    // 1. Hızlı başlangıç için localStorage'dan yükle (flash önleme)
    const local = localStorage.getItem('theme') as Theme | null
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const initial = local ?? system
    apply(initial)

    // 2. Hesap tercihini fetch et ve senkronize et
    supabase.auth.getUser().then(({ data }) => {
      const accountTheme = data?.user?.user_metadata?.theme as Theme | undefined
      if (accountTheme && accountTheme !== initial) {
        apply(accountTheme)
        localStorage.setItem('theme', accountTheme)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function apply(t: Theme) {
    setTheme(t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }

  async function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    apply(next)
    localStorage.setItem('theme', next)
    // Hesaba kaydet (arka planda, hata olsa bile UI etkilenmez)
    supabase.auth.updateUser({ data: { theme: next } }).catch(() => {})
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
