'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 각 항목이 가리키는 곳은 홈 안의 섹션이다.
 *
 * 예전에는 `#matches` 같은 해시만 넣어 두어서, 경기 상세나 플레이어 상세에서
 * 누르면 그 페이지에 없는 앵커라 아무 일도 일어나지 않았다. 홈이 아닐 때는
 * 홈으로 이동하면서 해시를 함께 넘긴다.
 */
const NAV_ITEMS = [
  { hash: '#home', label: '홈', icon: '⌂' },
  { hash: '#matches', label: '경기', icon: '▤' },
  { hash: '#players', label: '선수', icon: '♙' },
  { hash: '#records', label: '기록', icon: '🏆' },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const onHome = pathname === '/'

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe4ea] bg-[#f8fafc]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-4px_16px_rgba(25,31,40,0.06)] backdrop-blur sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ITEMS.map(item => {
          const className =
            'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium text-[#4e5968] transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
          const content = (
            <>
              <span aria-hidden="true" className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </>
          )
          return onHome ? (
            <a key={item.hash} href={item.hash} className={className}>{content}</a>
          ) : (
            <Link key={item.hash} href={`/${item.hash}`} className={className}>{content}</Link>
          )
        })}
      </div>
    </nav>
  )
}
