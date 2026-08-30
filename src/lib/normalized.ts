import type { Game, GameResult } from './types'

export type NormalizedResult = 'WIN' | 'LOSS' | 'UNKNOWN'
export type DataQuality = 'COMPLETE' | 'PARTIAL' | 'INVALID'

export interface NormalizedAugment {
  id: number
  name: string
}

export interface NormalizedItem {
  id: number
  name: string
}

export interface NormalizedSquadParticipant {
  playerId: string
  displayName: string
  championId: number | null
  championName: string | null
  championImage: string | null
  championTypes: string[]
  kills: number | null
  deaths: number | null
  assists: number | null
  damageToChampions: number | null
  damageTaken: number | null
  damageMitigated: number | null
  healingToAllies: number | null
  shieldingToAllies: number | null
  ccSeconds: number | null
  goldEarned: number | null
  augments: NormalizedAugment[]
  items: NormalizedItem[]
}

export interface NormalizedMatch {
  matchId: string
  mode: 'ARAM_MAYHEM' | string
  gameStartedAtUtc: string
  durationSeconds: number | null
  result: NormalizedResult
  teamKills: number | null
  opponentKills: number | null
  patch: string | null
  sourceUpdatedAtUtc: string | null
  dataQuality: DataQuality
  participants: NormalizedSquadParticipant[]
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeParticipant(result: GameResult): NormalizedSquadParticipant {
  const player = result.players
  const championName = typeof result.champion_name === 'string' && result.champion_name.length > 0
    ? result.champion_name
    : null
  const championId = nullableNumber(result.champion_id)
  return {
    playerId: player?.puuid ?? result.id,
    displayName: player?.game_name ?? '알 수 없는 선수',
    championId,
    championName,
    championImage: null,
    championTypes: [],
    kills: nullableNumber(result.kills),
    deaths: nullableNumber(result.deaths),
    assists: nullableNumber(result.assists),
    damageToChampions: nullableNumber(result.damage_dealt),
    damageTaken: nullableNumber(result.damage_taken),
    damageMitigated: null,
    healingToAllies: null,
    shieldingToAllies: null,
    ccSeconds: nullableNumber(result.cc_score),
    goldEarned: nullableNumber(result.gold_earned),
    augments: (result.augment_ids ?? []).filter(Number.isFinite).map(id => ({ id, name: `증강 #${id}` })),
    items: (result.item_ids ?? []).filter(Number.isFinite).map(id => ({ id, name: `아이템 #${id}` })),
  }
}

export function normalizeGame(game: Game): NormalizedMatch {
  const participants = game.game_results.map(normalizeParticipant)
  const validDate = !Number.isNaN(new Date(game.played_at).getTime())
  const hasFourPlayers = participants.filter(participant => participant.playerId !== '').length >= 4
  const hasInvalidParticipant = participants.some(participant => !participant.championName)
  const quality: DataQuality = !validDate || !game.id
    ? 'INVALID'
    : hasInvalidParticipant || !hasFourPlayers ? 'PARTIAL' : 'COMPLETE'

  return {
    matchId: game.match_id,
    mode: 'ARAM_MAYHEM',
    gameStartedAtUtc: validDate ? new Date(game.played_at).toISOString() : '',
    durationSeconds: nullableNumber(game.duration_seconds),
    result: game.our_team_win === true ? 'WIN' : game.our_team_win === false ? 'LOSS' : 'UNKNOWN',
    teamKills: null,
    opponentKills: null,
    patch: null,
    sourceUpdatedAtUtc: null,
    dataQuality: quality,
    participants,
  }
}

export function normalizeGames(games: Game[]): NormalizedMatch[] {
  return games.map(normalizeGame)
}