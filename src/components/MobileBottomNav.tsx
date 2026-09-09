'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { homeHref } from '@/lib/experience'

const items = [
  { id: 'home', label: '오늘', icon: '⌂' },
  { id: 'matches', label: '경기', icon: '▤' },
  { id: 'players', label: '우리 넷', icon: '♙' },
  { id: 'records', label: '기록', icon: '♜' },
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
            {!desktop && <span aria-hidden="true">{item.icon}</span>}
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
