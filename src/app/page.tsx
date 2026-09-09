import SyncButton from '@/components/SyncButton'
import { Suspense } from 'react'
import DashboardClient from '@/components/DashboardClient'
import {
  fetchChampionCatalog,
  toChampionNameMap,
  toChampionRoleLabels,
} from '@/lib/championNames'
import { fetchGames, fetchPlayers, getCachedNicknames } from '@/lib/games'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // 이름과 역할 라벨은 같은 카탈로그에서 나온다. 한 번만 받는다.
  const [allGames, players, championCatalog, initialNicknames] =
    await Promise.all([
      fetchGames(),
      fetchPlayers(),
      fetchChampionCatalog(),
      getCachedNicknames(),
    ])
  const championNames = toChampionNameMap(championCatalog)
  const champRoles = toChampionRoleLabels(championCatalog)

  return (
    <div>
      <div className="site-intro">
        <div className="intro-copy">
          <h1>네 명이 남긴 나락 일지.</h1>
          <p>잘한 판도, 망한 판도 우리 기록.</p>
        </div>
        <SyncButton />
      </div>
      <Suspense
        fallback={<p className="empty-state">우리 기록을 펼치는 중…</p>}
      >
        <DashboardClient
          allGames={allGames}
          players={players}
          initialNicknames={initialNicknames}
          champRoles={champRoles}
          championNames={championNames}
        />
      </Suspense>
    </div>
  )
}
