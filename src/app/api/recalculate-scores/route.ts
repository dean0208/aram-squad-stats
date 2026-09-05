import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServerClient } from '@/lib/supabase'
import { calculateFairScores } from '@/lib/scoring'
import { fetchChampionIdToName, fetchChampionRoles } from '@/lib/championRoles'
import { GAMES_CACHE_TAG } from '@/lib/games'

interface StoredResult {
  id: string
  game_id: string
  player_id: string
  champion_id: number
  champion_name: string
  kills: number
  deaths: number
  assists: number
  damage_dealt: number
  damage_taken: number
  healing: number
  cc_score: number
  players: { puuid: string } | null
}

interface ResultUpdate {
  id: string
  game_id: string
  player_id: string
  champion_id: number
  champion_name: string
  perf_score: number
  contribution_score: number
}

/** DDragon 에 없던 시절 저장돼 `Champion800` 형태로 남은 이름. */
const UNRESOLVED_NAME = /^Champion\d+$/

/**
 * 저장된 모든 경기의 점수를 현재 모델로 다시 계산한다.
 * 이름이 해석되지 않은 채 저장된 챔피언도 함께 복구한다.
 *
 * 점수 모델 상수를 바꾼 뒤에는 반드시 한 번 실행해야 화면과 저장값이 맞는다.
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.LCU_SYNC_SECRET ?? ''
  const providedSecret = request.headers.get('x-lcu-sync-secret') ?? ''
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const [championRoles, championIdToName] = await Promise.all([
      fetchChampionRoles(),
      fetchChampionIdToName(),
    ])

    const { data: games, error } = await supabase
      .from('games')
      .select(`
        id,
        our_team_win,
        duration_seconds,
        game_results (
          id,
          game_id,
          player_id,
          champion_id,
          champion_name,
          kills,
          deaths,
          assists,
          damage_dealt,
          damage_taken,
          healing,
          cc_score,
          players ( puuid )
        )
      `)

    if (error) throw error

    const errors: string[] = []
    const updates: ResultUpdate[] = []
    let renamed = 0

    for (const game of games ?? []) {
      const results = (game.game_results ?? []) as unknown as StoredResult[]

      // 이름이 안 풀린 채 저장된 챔피언은 최신 카탈로그로 복구한다.
      const named = results.map(result => {
        const repaired = UNRESOLVED_NAME.test(result.champion_name ?? '')
          ? championIdToName[result.champion_id]
          : undefined
        if (repaired) renamed++
        return { ...result, champion_name: repaired ?? result.champion_name }
      })

      const participants = named
        .filter(result => result.players?.puuid)
        .map(result => ({
          puuid: result.players!.puuid,
          championName: result.champion_name,
          win: game.our_team_win,
          kills: result.kills,
          deaths: result.deaths,
          assists: result.assists,
          totalDamageDealtToChampions: result.damage_dealt,
          totalDamageTaken: result.damage_taken,
          totalHeal: result.healing,
          totalTimeCCDealt: result.cc_score,
        }))

      const scores = calculateFairScores(participants, {
        durationSeconds: game.duration_seconds,
        roles: championRoles,
      })

      for (const result of named) {
        const puuid = result.players?.puuid
        const score = puuid ? scores.get(puuid) : undefined
        if (score === undefined) continue
        updates.push({
          id: result.id,
          game_id: result.game_id,
          player_id: result.player_id,
          champion_id: result.champion_id,
          champion_name: result.champion_name,
          perf_score: score,
          contribution_score: score,
        })
      }
    }

    // 결과 하나당 UPDATE를 왕복하면 수천 번이라 함수 타임아웃에 걸린다.
    const BATCH_SIZE = 500
    let updated = 0

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)
      const { error: upsertError } = await supabase
        .from('game_results')
        .upsert(batch, { onConflict: 'id' })
      if (upsertError) errors.push(`batch ${Math.floor(i / BATCH_SIZE)}: ${upsertError.message}`)
      else updated += batch.length
    }

    if (updated > 0) revalidateTag(GAMES_CACHE_TAG, { expire: 0 })

    return Response.json({ games: games?.length ?? 0, updated, renamed, errors })
  } catch (error) {
    console.error('Score recalculation error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
