// Shared types for API responses and UI

export interface Player {
  id: string
  puuid: string
  game_name: string
  tag_line: string
}

/**
 * The player row nested inside a game_result. List views select only the two
 * columns they read, so the rest are present on detail queries only.
 */
export type GameResultPlayer = Pick<Player, 'puuid' | 'game_name'> &
  Partial<Pick<Player, 'id' | 'tag_line'>>

export interface GameResult {
  id: string
  champion_name: string
  champion_id: number
  kills: number
  deaths: number
  assists: number
  damage_dealt: number
  damage_taken: number
  healing: number
  gold_earned: number
  cc_score: number
  perf_score: number
  contribution_score: number
  augment_ids: number[]
  item_ids?: number[]
  players: GameResultPlayer | null
}

export interface Game {
  id: string
  match_id: string
  played_at: string
  duration_seconds: number
  our_team_win: boolean
  our_team_id: number
  game_results: GameResult[]
}

export interface ChampionReport {
  champion_name: string
  champion_id: number
  games: number
  wins: number
  win_rate: number
  avg_perf_score: number
  avg_contribution_score: number
  avg_kills: number
  avg_deaths: number
  avg_assists: number
  avg_kda: number
  is_suspect: boolean
  high_perf_losses: number
}

export interface PlayerReport {
  player: Player
  champion_report: ChampionReport[]
  total_games: number
  total_wins: number
}
