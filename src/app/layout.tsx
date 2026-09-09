import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import Link from 'next/link'
import MobileBottomNav from '@/components/MobileBottomNav'
import './globals.css'
import './experience.css'

const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  weight: '100 900',
  display: 'swap',
})

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
      className={`${pretendard.variable} ${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <a className="sr-only focus:not-sr-only" href="#home">
          본문으로 건너뛰기
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="site-brand">
              <span className="brand-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span>
                마 좀 치나?<small>ARAM SQUAD CLUB</small>
              </span>
            </Link>
            <span className="site-caption">네 명의 친구. 하나의 나락.</span>
            <Suspense>
              <MobileBottomNav desktop />
            </Suspense>
          </div>
        </header>
        <main id="home" className="site-main">
          {children}
        </main>
        <footer className="site-footer">
          <span>
            마 좀 치나? <b>© ARAM SQUAD CLUB</b>
          </span>
          <span>기록은 남고, 다음 판은 온다.</span>
        </footer>
        <Suspense>
          <MobileBottomNav />
        </Suspense>
      </body>
    </html>
  )
}
