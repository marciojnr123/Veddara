import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Veddara — Dashboard',
  description: 'Dashboard de gestão Veddara',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
