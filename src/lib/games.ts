import { unstable_cache } from 'next/cache'
import { createServerClient } from './supabase'
import { computeNicknames } from './nicknames'
import type { NicknameAward } from './nicknames'
import type { Game } from './types'

/** Tag for every cached derivation of the games table. Invalidated on sync. */
export const GAMES_CACHE_TAG = 'games'

export const DEFAULT_GAME_LIMIT = 500

/**
 * List views only ever read `puuid`/`game_name` off the nested player, and the
 * nested row repeats once per game_result. Selecting the two used columns keeps
 * roughly half the duplicated bytes out of the payload.
 */
const GAME_SELECT_LIST = `
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
      puuid,
      game_name
    )
  )
`

/** Single-game views additionally render the Riot tag line. */
const GAME_SELECT_DETAIL = `
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

export function clampGameLimit(raw: string | null): number {
  if (!raw) return DEFAULT_GAME_LIMIT
  const parsed = parseInt(raw, 10)
  if (Number.isNaN(parsed)) return DEFAULT_GAME_LIMIT
  return Math.max(1, Math.min(DEFAULT_GAME_LIMIT, parsed))
}

/** Most recent games with their tracked-player results, newest first. */
export async function fetchGames(limit: number = DEFAULT_GAME_LIMIT): Promise<Game[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('games')
    .select(GAME_SELECT_LIST)
    .order('played_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as Game[]
}

export async function fetchGameById(id: string): Promise<Game | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('games')
    .select(GAME_SELECT_DETAIL)
    .eq('id', id)
    .single()

  if (error) throw error
  return (data ?? null) as unknown as Game | null
}

/**
 * Milestone awards are squad-wide, so every player page used to re-read the
 * whole games table just to filter one player's awards out of the result. The
 * award list is small and only changes on sync, so it is cached under
 * GAMES_CACHE_TAG instead.
 */
export const getCachedNicknames = unstable_cache(
  async (): Promise<NicknameAward[]> => computeNicknames(await fetchGames()),
  ['squad-nicknames'],
  { tags: [GAMES_CACHE_TAG] },
)
