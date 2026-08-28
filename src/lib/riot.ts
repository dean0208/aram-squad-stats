import { RIOT_BASE, TRACKED_PUUIDS, TRACKED_PLAYERS, DATA_START_DATE } from './config'
import { createServerClient } from './supabase'
import { calculateFairScores } from './scoring'

const riotHeaders = () => ({
  'X-Riot-Token': process.env.RIOT_API_KEY ?? '',
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiotParticipant {
  puuid: string
  championId: number
  championName: string
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  totalHeal: number
  totalTimeCCDealt: number
  goldEarned: number
  // Augment fields (ARAM 2024+)
  playerAugment1?: number
  playerAugment2?: number
  playerAugment3?: number
  playerAugment4?: number
  // missions sub-object (fallback)
  missions?: {
    playerAugment1?: number
    playerAugment2?: number
    playerAugment3?: number
    playerAugment4?: number
  }
}

export interface RiotMatchDetail {
  metadata: { matchId: string; participants: string[] }
  info: {
    queueId: number
    gameStartTimestamp: number
    gameDuration: number
    participants: RiotParticipant[]
  }
}

// ─── Riot API Fetchers ────────────────────────────────────────────────────────

// Supported queue IDs: 480 = Swiftplay, 450 = ARAM, 2400 = ARAM Mayhem (증강)
const SUPPORTED_QUEUES = [480, 450, 2400]

export async function fetchRecentMatches(puuid: string, count = 20): Promise<string[]> {
  // Fetch without queue filter then dedupe — single call is simpler than multiple
  const url = `${RIOT_BASE}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=${count}`
  const res = await fetch(url, { headers: riotHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Riot match history ${res.status}: ${text}`)
  }
  return res.json()
}

export async function fetchMatchDetail(matchId: string): Promise<RiotMatchDetail> {
  const url = `${RIOT_BASE}/lol/match/v5/matches/${matchId}`
  const res = await fetch(url, { headers: riotHeaders() })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Riot match detail ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── Score Calculation ────────────────────────────────────────────────────────

/** Calculate a continuous 0-100 score using team-relative contributions. */
export function calcPerfScore(
  participant: RiotParticipant,
  allParticipants: RiotParticipant[],
): number {
  return calculateFairScores(allParticipants).get(participant.puuid) ?? 0
}

/**
 * Keep the existing ingestion API name, but store the actual score rather
 * than converting the tracked-player ranking into 100/67/33/0.
 */
export function calcContributionScore(
  puuid: string,
  trackedParticipants: { puuid: string; perf: number }[],
): number {
  return trackedParticipants.find((p) => p.puuid === puuid)?.perf ?? 0
}

// ─── Augment extraction helper ────────────────────────────────────────────────

function extractAugmentIds(p: RiotParticipant): number[] {
  const ids: number[] = []
  for (let i = 1; i <= 4; i++) {
    const key = `playerAugment${i}` as keyof RiotParticipant
    const mKey = `playerAugment${i}` as keyof NonNullable<RiotParticipant['missions']>
    const val = (p[key] as number | undefined) ?? p.missions?.[mKey]
    if (val && val > 0) ids.push(val)
  }
  return ids
}

// ─── Main Sync Logic ──────────────────────────────────────────────────────────

export async function syncNewGames(): Promise<{ synced: number; skipped: number }> {
  const supabase = createServerClient()

  // Ensure players exist in DB
  for (const player of TRACKED_PLAYERS) {
    await supabase.from('players').upsert(
      {
        puuid: player.puuid,
        game_name: player.gameName,
        tag_line: player.tagLine,
      },
      { onConflict: 'puuid' },
    )
  }

  // Fetch player rows to get UUIDs
  const { data: playerRows } = await supabase
    .from('players')
    .select('id, puuid')
    .in('puuid', TRACKED_PLAYERS.map((p) => p.puuid))

  const playerIdMap = new Map<string, string>()
  for (const row of playerRows ?? []) {
    playerIdMap.set(row.puuid, row.id)
  }

  // Fetch recent matches for all tracked players
  const matchSets = await Promise.all(
    TRACKED_PLAYERS.map((p) =>
      fetchRecentMatches(p.puuid, 100).catch(() => [] as string[]),
    ),
  )

  // Build a map of matchId → set of tracked puuids who played
  const matchParticipation = new Map<string, Set<string>>()
  for (let i = 0; i < TRACKED_PLAYERS.length; i++) {
    const puuid = TRACKED_PLAYERS[i].puuid
    for (const matchId of matchSets[i]) {
      if (!matchParticipation.has(matchId)) {
        matchParticipation.set(matchId, new Set())
      }
      matchParticipation.get(matchId)!.add(puuid)
    }
  }

  // Only process matches with all 4 tracked players
  const candidateMatches = [...matchParticipation.entries()]
    .filter(([, players]) => players.size === TRACKED_PLAYERS.length)
    .map(([matchId]) => matchId)

  // Skip already-stored matches
  const { data: existingGames } = await supabase
    .from('games')
    .select('match_id')
    .in('match_id', candidateMatches)

  const existingSet = new Set((existingGames ?? []).map((g) => g.match_id))
  const newMatches = candidateMatches.filter((id) => !existingSet.has(id))

  let synced = 0
  const skipped = candidateMatches.length - newMatches.length

  // Rate limiting: Riot dev key = 20 req/s, 100 req/2min
  // We'll process sequentially with a small delay to be safe
  for (const matchId of newMatches) {
    try {
      await new Promise((r) => setTimeout(r, 100)) // 100ms between requests
      const match = await fetchMatchDetail(matchId)

      const { info } = match
      const trackedInMatch = info.participants.filter((p) =>
        TRACKED_PUUIDS.has(p.puuid),
      )

      if (trackedInMatch.length < TRACKED_PLAYERS.length) continue

      // Skip unsupported queue types
      const queueId = match.info?.queueId ?? 0
      if (!SUPPORTED_QUEUES.includes(queueId)) continue

      // Skip games before DATA_START_DATE
      const gameDate = new Date(info.gameStartTimestamp)
      if (gameDate < DATA_START_DATE) continue

      // Determine our team (majority team of tracked players)
      const teamCounts = new Map<number, number>()
      for (const p of trackedInMatch) {
        teamCounts.set(p.teamId, (teamCounts.get(p.teamId) ?? 0) + 1)
      }
      const ourTeamId = [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const ourTeamWin = trackedInMatch.find((p) => p.teamId === ourTeamId)?.win ?? false

      // Insert game
      const { data: gameRow, error: gameErr } = await supabase
        .from('games')
        .insert({
          match_id: matchId,
          played_at: new Date(info.gameStartTimestamp).toISOString(),
          duration_seconds: info.gameDuration,
          our_team_win: ourTeamWin,
          our_team_id: ourTeamId,
        })
        .select('id')
        .single()

      if (gameErr || !gameRow) {
        console.error(`Failed to insert game ${matchId}:`, gameErr)
        continue
      }

      // Calculate perf scores for tracked players
      const perfScores = trackedInMatch.map((p) => ({
        puuid: p.puuid,
        perf: calcPerfScore(p, info.participants),
      }))

      // Insert game results for each tracked player
      for (const p of trackedInMatch) {
        const playerId = playerIdMap.get(p.puuid)
        if (!playerId) continue

        const perf = perfScores.find((ps) => ps.puuid === p.puuid)?.perf ?? 0
        const contribution = calcContributionScore(p.puuid, perfScores)
        const augmentIds = extractAugmentIds(p)

        await supabase.from('game_results').insert({
          game_id: gameRow.id,
          player_id: playerId,
          champion_id: p.championId,
          champion_name: p.championName,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          damage_dealt: p.totalDamageDealtToChampions,
          damage_taken: p.totalDamageTaken,
          healing: p.totalHeal,
          gold_earned: p.goldEarned,
          cc_score: p.totalTimeCCDealt,
          augment_ids: augmentIds,
          perf_score: Math.round(perf * 10) / 10,
          contribution_score: contribution,
        })
      }

      synced++
    } catch (err) {
      console.error(`Error processing match ${matchId}:`, err)
    }
  }

  return { synced, skipped }
}
