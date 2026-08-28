import { createServerClient } from '@/lib/supabase'
import { computeNicknames } from '@/lib/nicknames'
import type { Game } from '@/lib/types'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.max(1, Math.min(500, parseInt(limitParam, 10))) : 500

    const { data: games, error } = await supabase
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
      .limit(limit)

    if (error) throw error

    const typedGames = (games ?? []) as unknown as Game[]
    const nicknames = computeNicknames(typedGames)

    return Response.json({ nicknames, gamesCount: typedGames.length })
  } catch (err) {
    console.error('Badges API error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
