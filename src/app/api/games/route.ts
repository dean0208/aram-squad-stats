import { createServerClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServerClient()

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
      .limit(50)

    if (error) throw error

    return Response.json(games)
  } catch (err) {
    console.error('Games API error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
