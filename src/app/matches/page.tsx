import Link from 'next/link'
import { getServerGames } from '@/lib/serverData'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export default async function MatchesPage() {
  const games = await getServerGames()
  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm font-medium text-blue-600">← 홈으로</Link>
      <header>
        <p className="text-sm font-semibold text-blue-600">MATCHES</p>
        <h1 className="mt-1 text-2xl font-bold text-[#191f28]">전체 경기</h1>
        <p className="mt-1 text-sm text-[#6b7684]">저장된 경기 {games.length}개 · 최신순</p>
      </header>
      <div className="space-y-3">
        {games.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-[#6b7684]">저장된 경기가 없습니다.</p>}
        {games.map(game => {
          const count = game.game_results.filter(result => result.players).length
          return (
            <Link key={game.id} href={`/games/${encodeURIComponent(game.id)}`} className="block rounded-2xl border border-[#e5e8eb] bg-white p-4 shadow-sm transition hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-lg font-bold ${game.our_team_win ? 'text-emerald-700' : 'text-rose-700'}`}>{game.our_team_win ? '승리' : '패배'}</p>
                  <p className="mt-1 text-sm text-[#4e5968]">{formatDate(game.played_at)} · {Math.floor(game.duration_seconds / 60)}분</p>
                </div>
                <span className="text-xs font-medium text-[#8b95a1]">{count}/4명</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {game.game_results.map(result => <span key={result.id} className="rounded-lg bg-[#f2f4f6] px-2 py-1 text-xs text-[#4e5968]">{result.champion_name}</span>)}
              </div>
              {count < 4 && <p className="mt-3 text-xs font-medium text-amber-700">부분 데이터 · 일부 선수 정보가 없습니다</p>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
