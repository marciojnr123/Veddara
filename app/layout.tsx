import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vedara — Analytics',
  description: 'Sistema de análise de dados Vedara',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
