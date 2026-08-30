import Link from 'next/link'
import { getServerPlayers } from '@/lib/serverData'
import { getPlayerDisplayName } from '@/lib/config'

export default async function PlayersPage() {
  const players = await getServerPlayers()
  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm font-medium text-blue-600">← 홈으로</Link>
      <header>
        <p className="text-sm font-semibold text-blue-600">PLAYERS</p>
        <h1 className="mt-1 text-2xl font-bold text-[#191f28]">선수</h1>
        <p className="mt-1 text-sm text-[#6b7684]">스쿼드 멤버별 상세 기록</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {players.map(player => (
          <Link key={player.puuid} href={`/players/${encodeURIComponent(player.puuid)}`} className="rounded-2xl border border-[#e5e8eb] bg-white p-5 shadow-sm transition hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <p className="text-lg font-bold text-[#191f28]">{getPlayerDisplayName(player.puuid, player.game_name)}</p>
            <p className="mt-1 text-sm text-[#6b7684]">#{player.tag_line}</p>
            <p className="mt-4 text-sm font-semibold text-blue-600">상세 프로필 →</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
