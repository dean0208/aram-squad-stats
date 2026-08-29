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
  title: '마 좀 치나?',
  description: '4인 증바람 게임 기록과 플레이어별 기여도를 분석합니다.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="toss-theme min-h-full flex flex-col bg-[#f6f7f9] text-[#191f28] antialiased">
        <nav className="border-b border-[#e5e8eb] bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <a href="/" className="text-lg font-bold text-blue-500 hover:text-blue-600 transition-colors">
            마 좀 치나?
          </a>
        </nav>
        <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
          {children}
        </main>
      </body>
    </html>
  )
}
