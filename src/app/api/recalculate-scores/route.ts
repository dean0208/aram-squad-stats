import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { calculateFairScores } from '@/lib/scoring'

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.LCU_SYNC_SECRET ?? ''
  const providedSecret = request.headers.get('x-lcu-sync-secret') ?? ''
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const { data: games, error } = await supabase
      .from('games')
      .select(`
        id,
        our_team_win,
        game_results (
          id,
          kills,
          assists,
          damage_dealt,
          damage_taken,
          healing,
          cc_score,
          players ( puuid )
        )
      `)

    if (error) throw error

    let updated = 0
    const errors: string[] = []

    for (const game of games ?? []) {
      const results = (game.game_results ?? []) as unknown as Array<{
        id: string
        kills: number
        assists: number
        damage_dealt: number
        damage_taken: number
        healing: number
        cc_score: number
        players: { puuid: string } | null
      }>
      const participants = results
        .filter(result => result.players?.puuid)
        .map(result => ({
          puuid: result.players!.puuid,
          teamId: 1,
          win: game.our_team_win,
          kills: result.kills,
          assists: result.assists,
          totalDamageDealtToChampions: result.damage_dealt,
          totalDamageTaken: result.damage_taken,
          totalHeal: result.healing,
          totalTimeCCDealt: result.cc_score,
        }))
      const scores = calculateFairScores(participants)

      for (const result of results) {
        const puuid = result.players?.puuid
        const score = puuid ? scores.get(puuid) : undefined
        if (score === undefined) continue

        const { error: updateError } = await supabase
          .from('game_results')
          .update({ perf_score: score, contribution_score: score })
          .eq('id', result.id)
        if (updateError) errors.push(`${game.id}/${result.id}: ${updateError.message}`)
        else updated++
      }
    }

    return Response.json({ games: games?.length ?? 0, updated, errors })
  } catch (error) {
    console.error('Score recalculation error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
