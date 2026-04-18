import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Asistan Aksiyonları — PulseApp',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
