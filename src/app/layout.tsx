import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import MobileBottomNav from '@/components/MobileBottomNav'
import './globals.css'
import './experience.css'

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <a className="sr-only focus:not-sr-only" href="#home">
          본문으로 건너뛰기
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="site-brand">
              마 좀 치나?
            </Link>
            <span className="site-caption">
              FOUR FRIENDS · ONE HOWLING ABYSS
            </span>
            <Suspense>
              <MobileBottomNav desktop />
            </Suspense>
          </div>
        </header>
        <main id="home" className="site-main">
          {children}
        </main>
        <Suspense>
          <MobileBottomNav />
        </Suspense>
      </body>
    </html>
  )
}
