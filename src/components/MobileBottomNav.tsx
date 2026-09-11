'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { homeHref } from '@/lib/experience'

const items = [
  {
    id: 'home',
    label: '오늘',
    path: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  },
  {
    id: 'matches',
    label: '경기',
    path: 'M5 3h14v18H5z M9 7h6 M9 12h6 M9 17h3',
  },
  {
    id: 'players',
    label: '개인 기록',
    path: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3 M17 4a4 4 0 0 1 0 7 M19 14a5 5 0 0 1 3 4v3',
  },
  {
    id: 'records',
    label: '랭킹',
    path: 'M7 3h10v6a5 5 0 0 1-10 0Z M7 5H3v3a4 4 0 0 0 4 4 M17 5h4v3a4 4 0 0 1-4 4 M12 14v7 M7 21h10',
  },
]

export default function MobileBottomNav({
  desktop = false,
}: {
  desktop?: boolean
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const [section, setSection] = useState('home')
  useEffect(() => {
    let frame = 0
    function update() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        let active = 'home'
        for (const item of items) {
          const rect = document.getElementById(item.id)?.getBoundingClientRect()
          if (rect && rect.top <= window.innerHeight * 0.35) active = item.id
        }
        setSection(active)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
    }
  }, [pathname])
  const active = pathname.startsWith('/players/')
    ? 'players'
    : pathname.startsWith('/games/')
      ? 'matches'
      : section
  return (
    <nav
      aria-label={desktop ? '주요 메뉴' : '하단 메뉴'}
      className={desktop ? 'desktop-nav' : 'bottom-nav'}
    >
      {items.map((item) => {
        const props = {
          className: '',
          'aria-current':
            active === item.id ? ('location' as const) : undefined,
        }
        const content = (
          <>
            {!desktop && (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="21"
                height="21"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.path} />
              </svg>
            )}
            {item.label}
          </>
        )
        return pathname === '/' ? (
          <a key={item.id} href={`?${params.toString()}#${item.id}`} {...props}>
            {content}
          </a>
        ) : (
          <Link
            key={item.id}
            href={`${homeHref(params.get('date') ?? undefined)}#${item.id}`}
            {...props}
          >
            {content}
          </Link>
        )
      })}
    </nav>
  )
}
