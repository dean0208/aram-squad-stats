import { createServerClient } from '@/lib/supabase'
import { TRACKED_PLAYERS } from '@/lib/config'
import SyncButton from '@/components/SyncButton'
import DashboardClient from '@/components/DashboardClient'
import type { Game } from '@/lib/types'
import { computeNicknames } from '@/lib/nicknames'

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
  const [allGames, players] = await Promise.all([getAllGames(), getPlayers()])

  // Compute initial nicknames server-side (full history)
  const initialNicknames = computeNicknames(allGames)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">ARAM Squad Stats</h1>
          <p className="text-gray-400 mt-1">OCE server • 4-stack ARAM tracker</p>
        </div>
        <SyncButton />
      </div>

      {/* Client component handles filter + all sections */}
      <DashboardClient
        allGames={allGames}
        players={players}
        initialNicknames={initialNicknames}
      />
    </div>
  )
}
