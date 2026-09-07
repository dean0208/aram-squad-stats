import { NextRequest } from 'next/server'
import { TRACKED_PUUIDS } from '@/lib/config'
import { fetchMatchDetail } from '@/lib/riot'
import { createServerClient } from '@/lib/supabase'

/**
 * 과거 경기의 새 지표를 Riot 응답에서 다시 읽어 채운다.
 *
 * 실드·하드CC·막아낸 피해는 점수 축을 고치면서 새로 쓰기 시작한 값이라
 * 저장된 경기에는 없다. 다행히 셋 다 Match-V5 응답에 원래부터 있던 필드라
 * `match_id` 로 다시 읽으면 과거도 채울 수 있다. cc_score 와
 * heals_on_teammates 도 같은 김에 덮어쓴다 — 수집 초기에 필드명이 갈려
 * 0으로 저장된 구간이 있었다.
 *
 * 점수는 여기서 건드리지 않는다. 데이터를 다 채운 뒤 보정계수를 다시 맞추고
 * `/api/recalculate-scores` 를 한 번 돌리는 순서라야 눈금이 맞는다.
 *
 * Riot 키가 서버에만 있어서 로컬에서는 이 경로를 거쳐야 한다. 한 번에 다
 * 돌면 함수 제한시간을 넘기므로 `limit` 만큼만 처리하고 남은 수를 알려준다 —
 * 호출한 쪽이 0이 될 때까지 반복한다.
 */

// Riot 왕복이 경기당 한 번이라 기본 제한시간으로는 부족하다.
export const maxDuration = 60

/** 한 번에 처리할 경기 수 기본값. 60초 안에 끝나는 선. */
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 40

/** Riot 개발 키는 초당 20건이라 경기 사이에 조금 쉰다. */
const REQUEST_SPACING_MS = 120

/** 채울 컬럼 중 대표. 이 값이 NULL 이면 아직 백필되지 않은 경기다. */
const SENTINEL_COLUMN = 'shields_on_teammates'

interface BackfillResult {
  processed: number
  updatedRows: number
  remaining: number
  failed: { matchId: string; reason: string }[]
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.LCU_SYNC_SECRET ?? ''
  const providedSecret = request.headers.get('x-lcu-sync-secret') ?? ''
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RIOT_API_KEY) {
    return Response.json({ error: 'RIOT_API_KEY not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body?.limit) || DEFAULT_LIMIT))

  const supabase = createServerClient()

  // puuid → players.id. 결과 행은 player_id 로만 사람을 가리킨다.
  const { data: playerRows } = await supabase.from('players').select('id, puuid')
  const playerIdByPuuid = new Map((playerRows ?? []).map(r => [r.puuid as string, r.id as string]))

  // 아직 안 채운 경기를 고른다. PostgREST 는 서브쿼리를 못 쓰므로 두 번 읽는다.
  const { data: pending, error: pendingError } = await supabase
    .from('game_results')
    .select('game_id')
    .is(SENTINEL_COLUMN, null)
  if (pendingError) {
    return Response.json({ error: pendingError.message }, { status: 500 })
  }

  const pendingGameIds = [...new Set((pending ?? []).map(r => r.game_id as string))]
  const batch = pendingGameIds.slice(0, limit)

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, match_id')
    .in('id', batch)
  if (gamesError) {
    return Response.json({ error: gamesError.message }, { status: 500 })
  }

  const result: BackfillResult = {
    processed: 0,
    updatedRows: 0,
    remaining: pendingGameIds.length,
    failed: [],
  }

  for (const game of games ?? []) {
    try {
      await new Promise(r => setTimeout(r, REQUEST_SPACING_MS))
      const match = await fetchMatchDetail(game.match_id as string)

      const tracked = match.info.participants.filter(p => TRACKED_PUUIDS.has(p.puuid))
      if (tracked.length === 0) {
        result.failed.push({ matchId: game.match_id as string, reason: '추적 플레이어 없음' })
        continue
      }

      for (const p of tracked) {
        const playerId = playerIdByPuuid.get(p.puuid)
        if (!playerId) continue

        // 0 과 undefined 를 구분한다. 응답이 안 알려준 값을 0 으로 굳히면
        // "아무것도 안 했다" 와 "모른다" 가 같아진다.
        const num = (value: unknown): number | null =>
          typeof value === 'number' ? value : null

        const ccDealt =
          p.totalTimeCCDealt || p.totalTimeCrowdControlDealt || p.timeCCingOthers || 0

        const { error, count } = await supabase
          .from('game_results')
          .update({
            shields_on_teammates: num(p.totalDamageShieldedOnTeammates),
            damage_self_mitigated: num(p.damageSelfMitigated),
            hard_cc_count: num(p.challenges?.enemyChampionImmobilizations),
            heals_on_teammates: num(p.totalHealsOnTeammates),
            cc_score: ccDealt,
          }, { count: 'exact' })
          .eq('game_id', game.id)
          .eq('player_id', playerId)

        if (error) throw new Error(error.message)
        result.updatedRows += count ?? 0
      }

      result.processed += 1
    } catch (err) {
      result.failed.push({
        matchId: game.match_id as string,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  result.remaining = Math.max(0, pendingGameIds.length - result.processed)

  return Response.json(result)
}
