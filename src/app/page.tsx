import { createServerClient } from '@/lib/supabase'
import { TRACKED_PLAYERS, DDRAGON_BASE } from '@/lib/config'
import { fetchChampionNames } from '@/lib/championNames'
import SyncButton from '@/components/SyncButton'
import DashboardClient from '@/components/DashboardClient'
import type { Game } from '@/lib/types'
import { computeNicknames } from '@/lib/nicknames'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// DDragon tag → Korean role
const TAG_KO: Record<string, { label: string; emoji: string; damageType: 'AD' | 'AP' | 'Tank' | 'Utility' }> = {
  Marksman: { label: '원딜',   emoji: '🏹', damageType: 'AD' },
  Mage:     { label: '마법사', emoji: '🔮', damageType: 'AP' },
  Tank:     { label: '탱커',   emoji: '🛡️', damageType: 'Tank' },
  Fighter:  { label: '브루저', emoji: '⚡', damageType: 'AD' },
  Support:  { label: '서포터', emoji: '💊', damageType: 'Utility' },
  Assassin: { label: '암살자', emoji: '🗡️', damageType: 'AD' },
}

function formatSavedAt(iso?: string) {
  if (!iso) return '저장된 경기 없음'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

async function getChampRoles(): Promise<Record<string, { label: string; emoji: string; damageType: 'AD' | 'AP' | 'Tank' | 'Utility' }>> {
  try {
    const res = await fetch(`${DDRAGON_BASE}/data/en_US/champion.json`, { next: { revalidate: 86400 } })
    const data = await res.json()
    const map: Record<string, { label: string; emoji: string; damageType: 'AD' | 'AP' | 'Tank' | 'Utility' }> = {}
    for (const champ of Object.values(data.data) as { id: string; tags: string[] }[]) {
      const primaryTag = ['Marksman', 'Mage', 'Assassin', 'Fighter', 'Tank', 'Support'].find(tag => champ.tags.includes(tag)) ?? champ.tags[0]
      map[champ.id] = TAG_KO[primaryTag] ?? { label: '올라운더', emoji: '⚡', damageType: 'Utility' }
    }
    return map
  } catch {
    return {}
  }
}

async function getAllGames(): Promise<Game[]> {
  const supabase = createServerClient()

  const { data: games } = await supabase
    .from('games')
    .select(
      `
      id,
      match_id,
      played_at,
      duration_seconds,
      our_team_win,
      our_team_id,
      game_results (
        id,
        champion_name,
        champion_id,
        kills,
        deaths,
        assists,
        damage_dealt,
        damage_taken,
        healing,
        gold_earned,
        cc_score,
        perf_score,
        contribution_score,
        augment_ids,
        players (
          id,
          puuid,
          game_name,
          tag_line
        )
      )
    `,
    )
    .order('played_at', { ascending: false })
    .limit(500)

  return (games ?? []) as unknown as Game[]
}

async function getPlayers() {
  const supabase = createServerClient()
  const { data: players } = await supabase
    .from('players')
    .select('id, puuid, game_name, tag_line')

  if (!players?.length) return []

  // Sort by configured player order
  return [...players].sort((a, b) => {
    const ai = TRACKED_PLAYERS.findIndex((p) => p.puuid === a.puuid)
    const bi = TRACKED_PLAYERS.findIndex((p) => p.puuid === b.puuid)
    return ai - bi
  })
}

export default async function HomePage() {
  const [allGames, players, champRoles, championNames] = await Promise.all([
    getAllGames(),
    getPlayers(),
    getChampRoles(),
    fetchChampionNames(),
  ])
  const initialNicknames = computeNicknames(allGames)

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#191f28]">마 좀 치나?</h1>
          <p className="text-sm text-[#6b7684] mt-1">OCE · 4인 ARAM: Mayhem</p>
          <p className="mt-1 text-xs text-[#8b95a1]">마지막 저장 경기 · {formatSavedAt(allGames[0]?.played_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/data-status" className="hidden rounded-lg px-2 py-1 text-xs font-medium text-[#4e5968] hover:bg-[#f2f4f6] sm:inline-flex">
            데이터 상태
          </Link>
          <SyncButton />
        </div>
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
