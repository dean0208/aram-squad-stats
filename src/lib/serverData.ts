import { createServerClient } from './supabase'
import { TRACKED_PLAYERS } from './config'
import type { Game } from './types'

const GAME_SELECT = `
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
`

export async function getServerGames(limit = 500): Promise<Game[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('games')
      .select(GAME_SELECT)
      .order('played_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as unknown as Game[]
  } catch {
    return []
  }
}

export async function getServerPlayers() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('players')
      .select('id, puuid, game_name, tag_line')

    return [...(data ?? [])].sort((a, b) => {
      const ai = TRACKED_PLAYERS.findIndex(player => player.puuid === a.puuid)
      const bi = TRACKED_PLAYERS.findIndex(player => player.puuid === b.puuid)
      return ai - bi
    })
  } catch {
    return []
  }
}
