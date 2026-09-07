import { unstable_cache } from 'next/cache'
import { createServerClient } from './supabase'
import { computeNicknames } from './nicknames'
import type { NicknameAward } from './nicknames'
import { TRACKED_PLAYERS } from './config'
import type { Game, Player } from './types'

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

async function queryGames(limit: number): Promise<Game[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('games')
    .select(GAME_SELECT_LIST)
    .order('played_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as Game[]
}

/**
 * Most recent games with their tracked-player results, newest first.
 *
 * 대시보드는 요청마다 최대 500경기를 중첩 조인으로 읽었다. 이 목록은 동기화
 * 때만 바뀌므로 GAMES_CACHE_TAG 로 캐시하고, 동기화 경로가 태그를 무효화한다.
 */
export const fetchGames = unstable_cache(
  (limit: number = DEFAULT_GAME_LIMIT) => queryGames(limit),
  ['games-list'],
  { tags: [GAMES_CACHE_TAG] },
)

/** 추적 4인 행. 경기와 같은 시점에만 바뀌므로 같은 태그로 캐시한다. */
export const fetchPlayers = unstable_cache(
  async (): Promise<Player[]> => {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('players')
      .select('id, puuid, game_name, tag_line')
    if (error) throw error
    const rows = (data ?? []) as Player[]
    // 설정된 순서 그대로 보여준다.
    return [...rows].sort(
      (a, b) =>
        TRACKED_PLAYERS.findIndex((p) => p.puuid === a.puuid) -
        TRACKED_PLAYERS.findIndex((p) => p.puuid === b.puuid),
    )
  },
  ['players-list'],
  { tags: [GAMES_CACHE_TAG] },
)

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
