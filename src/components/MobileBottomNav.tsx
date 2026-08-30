import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/', label: '홈', icon: '⌂' },
  { href: '/matches', label: '경기', icon: '▤' },
  { href: '/players', label: '선수', icon: '♙' },
  { href: '/records', label: '기록', icon: '🏆' },
]

export default function MobileBottomNav() {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe4ea] bg-[#f8fafc]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-4px_16px_rgba(25,31,40,0.06)] backdrop-blur sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium text-[#4e5968] transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <span aria-hidden="true" className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
