import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Resonance — Philharmonie Luxembourg',
  description: 'Your AI cultural companion for Philharmonie Luxembourg. Discover concerts through personalized musical journeys.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  )
}
