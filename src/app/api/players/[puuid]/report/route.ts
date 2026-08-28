import { createServerClient } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ puuid: string }> },
) {
  try {
    const { puuid } = await params
    const supabase = createServerClient()

    // Get player
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .select('id, puuid, game_name, tag_line')
      .eq('puuid', puuid)
      .single()

    if (playerErr || !player) {
      return Response.json({ error: 'Player not found' }, { status: 404 })
    }

    // Get all game results for this player with game info
    const { data: results, error: resultsErr } = await supabase
      .from('game_results')
      .select(
        `
        champion_name,
        champion_id,
        kills,
        deaths,
        assists,
        perf_score,
        contribution_score,
        games (
          our_team_win
        )
      `,
      )
      .eq('player_id', player.id)

    if (resultsErr) throw resultsErr

    // Group by champion
    const championMap = new Map<
      string,
      {
        champion_name: string
        champion_id: number
        games: number
        wins: number
        total_perf: number
        total_contribution: number
        total_kills: number
        total_deaths: number
        total_assists: number
        high_perf_losses: number
      }
    >()

    for (const r of results ?? []) {
      const gameData = r.games as unknown as { our_team_win: boolean } | null
      const win = gameData?.our_team_win ?? false
      const existing = championMap.get(r.champion_name)

      const isHighPerfLoss = (r.perf_score ?? 0) > 60 && !win

      if (!existing) {
        championMap.set(r.champion_name, {
          champion_name: r.champion_name,
          champion_id: r.champion_id,
          games: 1,
          wins: win ? 1 : 0,
          total_perf: r.perf_score ?? 0,
          total_contribution: r.contribution_score ?? 0,
          total_kills: r.kills ?? 0,
          total_deaths: r.deaths ?? 0,
          total_assists: r.assists ?? 0,
          high_perf_losses: isHighPerfLoss ? 1 : 0,
        })
      } else {
        existing.games++
        if (win) existing.wins++
        existing.total_perf += r.perf_score ?? 0
        existing.total_contribution += r.contribution_score ?? 0
        existing.total_kills += r.kills ?? 0
        existing.total_deaths += r.deaths ?? 0
        existing.total_assists += r.assists ?? 0
        if (isHighPerfLoss) existing.high_perf_losses++
      }
    }

    const championReport = [...championMap.values()]
      .map((c) => ({
        champion_name: c.champion_name,
        champion_id: c.champion_id,
        games: c.games,
        wins: c.wins,
        win_rate: c.games > 0 ? Math.round((c.wins / c.games) * 100) : 0,
        avg_perf_score: c.games > 0 ? Math.round((c.total_perf / c.games) * 10) / 10 : 0,
        avg_contribution_score:
          c.games > 0 ? Math.round((c.total_contribution / c.games) * 10) / 10 : 0,
        avg_kills: c.games > 0 ? Math.round((c.total_kills / c.games) * 10) / 10 : 0,
        avg_deaths: c.games > 0 ? Math.round((c.total_deaths / c.games) * 10) / 10 : 0,
        avg_assists: c.games > 0 ? Math.round((c.total_assists / c.games) * 10) / 10 : 0,
        avg_kda:
          c.total_deaths > 0
            ? Math.round(((c.total_kills + c.total_assists) / c.total_deaths) * 10) / 10
            : c.total_kills + c.total_assists,
        // "Suspects": good perf but low winrate — possible synergy issue
        is_suspect:
          c.games >= 2 &&
          c.total_perf / c.games > 50 &&
          c.wins / c.games < 0.4,
        high_perf_losses: c.high_perf_losses,
      }))
      .sort((a, b) => b.games - a.games)

    return Response.json({
      player,
      champion_report: championReport,
      total_games: results?.length ?? 0,
      total_wins: championReport.reduce((a, c) => a + c.wins, 0),
    })
  } catch (err) {
    console.error('Player report API error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
