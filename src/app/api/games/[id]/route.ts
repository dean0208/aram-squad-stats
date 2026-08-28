import { createServerClient } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    const { data: game, error } = await supabase
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
      .eq('id', id)
      .single()

    if (error) throw error
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 })

    return Response.json(game)
  } catch (err) {
    console.error('Game detail API error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
