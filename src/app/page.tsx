import SyncButton from '@/components/SyncButton'
import DashboardClient from '@/components/DashboardClient'
import { fetchChampionCatalog, toChampionNameMap, toChampionRoleLabels } from '@/lib/championNames'
import { fetchGames, fetchPlayers, getCachedNicknames } from '@/lib/games'

export const dynamic = 'force-dynamic'

function formatSavedAt(iso?: string) {
  if (!iso) return '저장된 경기 없음'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export default async function HomePage() {
  // 이름과 역할 라벨은 같은 카탈로그에서 나온다. 한 번만 받는다.
  const [allGames, players, championCatalog, initialNicknames] = await Promise.all([
    fetchGames(),
    fetchPlayers(),
    fetchChampionCatalog(),
    getCachedNicknames(),
  ])
  const championNames = toChampionNameMap(championCatalog)
  const champRoles = toChampionRoleLabels(championCatalog)

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#191f28]">마 좀 치나?</h1>
          <p className="text-sm text-[#6b7684] mt-1">OCE · 4인 ARAM: Mayhem</p>
          <p className="mt-1 text-xs text-[#8b95a1]">마지막 저장 경기 · {formatSavedAt(allGames[0]?.played_at)}</p>
        </div>
        <SyncButton />
      </div>
      <DashboardClient
        allGames={allGames}
        players={players}
        initialNicknames={initialNicknames}
        champRoles={champRoles}
        championNames={championNames}
      />
    </div>
  )
}
