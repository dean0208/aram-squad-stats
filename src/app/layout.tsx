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
  title: '마 좀 뜨급나?',
  description: '4인 증바람 게임 기록과 플레이어별 기여도를 분석합니다.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-900 text-white antialiased">
        <nav className="border-b border-gray-800 bg-gray-950 px-6 py-4">
          <a href="/" className="text-lg font-bold text-purple-400 hover:text-purple-300 transition-colors">
            누가누가 잘했나😎
          </a>
        </nav>
        <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
          {children}
        </main>
      </body>
    </html>
  )
}
