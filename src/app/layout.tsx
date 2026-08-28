import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ARAM Squad Stats',
  description: 'Track ARAM performance for Hoodville, Interest Rate, Nunu and Lulu, just won lotto',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-900 text-white antialiased">
        <nav className="border-b border-gray-800 bg-gray-950 px-6 py-4">
          <a href="/" className="text-lg font-bold text-purple-400 hover:text-purple-300 transition-colors">
            🗡️ ARAM Squad Stats
          </a>
        </nav>
        <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
          {children}
        </main>
      </body>
    </html>
  )
}
