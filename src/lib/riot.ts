import { RIOT_BASE, TRACKED_PUUIDS, TRACKED_PLAYERS, DATA_START_DATE, SUPPORTED_QUEUES } from './config'
import { createServerClient } from './supabase'
import { calculateFairScores, type ScoreOptions } from './scoring'
import { fetchChampionRoles } from './championRoles'

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
  /** 팀원에게 준 힐만. 자힐이 빠져 있다. 구버전 응답에는 없다. */
  totalHealsOnTeammates?: number
  /** 팀원에게 준 실드량. 힐과 같은 HP 단위라 더해서 보호 축이 된다. */
  totalDamageShieldedOnTeammates?: number
  /** 방어 스탯·스킬로 막아낸 피해. "맞은 것" 과 "버틴 것" 을 가른다. */
  damageSelfMitigated?: number
  totalTimeCCDealt: number
  /** Match-V5 의 대안 필드명. 일부 응답은 이쪽만 채워 준다. */
  timeCCingOthers?: number
  totalTimeCrowdControlDealt?: number
  /** Match-V5 challenges. 오래된 응답에는 통째로 없을 수 있다. */
  challenges?: {
    /** 적을 실제로 묶은 횟수. CC 지속시간과 짝을 이룬다. */
    enemyChampionImmobilizations?: number
  }
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

export async function fetchRecentMatches(puuid: string, count = 20): Promise<string[]> {
  // Fetch without queue filter then dedupe — single call is simpler than multiple
  const url = `${RIOT_BASE}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=${count}`
  const res = await fetch(url, { headers: riotHeaders(), cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Riot match history ${res.status}: ${text}`)
  }
  return res.json()
}

export async function fetchMatchDetail(matchId: string): Promise<RiotMatchDetail> {
  const url = `${RIOT_BASE}/lol/match/v5/matches/${matchId}`
  // 캐시를 타면 키가 죽어도 성공처럼 보인다. 수집은 항상 실물로 때린다.
  const res = await fetch(url, { headers: riotHeaders(), cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    // 레이트리밋(429)과 인증 실패(403)는 대응이 다른데 본문만 보면 구분되지
    // 않는다. Riot 이 붙여 주는 진단 헤더를 함께 남긴다.
    const diagnostics = [
      'x-rate-limit-type',
      'retry-after',
      'x-app-rate-limit',
      'x-app-rate-limit-count',
      'x-method-rate-limit',
      'x-method-rate-limit-count',
    ]
      .map(name => [name, res.headers.get(name)] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== null)
      .map(([name, value]) => `${name}=${value}`)
      .join(' ')
    throw new Error(
      `Riot match detail ${res.status}: ${text}${diagnostics ? ` | ${diagnostics}` : ''}`,
    )
  }
  return res.json()
}

// ─── Score Calculation ────────────────────────────────────────────────────────

/**
 * 추적 4인의 0-100 점수를 한 번에 계산한다.
 *
 * 저장되는 `game_results` 에는 추적 플레이어만 남으므로, 수집 시점에 10인
 * 기준으로 계산하면 나중에 같은 점수를 재현할 수 없다. 두 경로가 같은 값을
 * 내도록 항상 추적 인원만 넘긴다.
 */
export function calcTeamPerfScores(
  trackedParticipants: RiotParticipant[],
  options: ScoreOptions = {},
): Map<string, number> {
  return calculateFairScores(trackedParticipants, options)
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

/**
 * CC 기여 시간을 응답에 실제로 담긴 필드에서 읽는다.
 * 포맷에 따라 이름이 갈리고, 한쪽만 읽으면 조용히 0으로 저장된다.
 */
function resolveCcDealt(p: RiotParticipant): number {
  return p.totalTimeCCDealt || p.totalTimeCrowdControlDealt || p.timeCCingOthers || 0
}

/**
 * 팀원에게 준 힐. 응답에 없으면 undefined 를 돌려주고, 점수 쪽에서 totalHeal
 * 로 폴백한다. 0 과 undefined 는 다르다 — 0 은 "아무도 안 살렸다" 이고
 * undefined 는 "이 응답은 알려주지 않는다" 이다.
 */
function resolveHealsOnTeammates(p: RiotParticipant): number | undefined {
  return typeof p.totalHealsOnTeammates === 'number' ? p.totalHealsOnTeammates : undefined
}

/** 팀원에게 준 실드. 없으면 undefined — 힐과 같은 이유로 0 과 구분한다. */
function resolveShieldsOnTeammates(p: RiotParticipant): number | undefined {
  return typeof p.totalDamageShieldedOnTeammates === 'number'
    ? p.totalDamageShieldedOnTeammates
    : undefined
}

/** 막아낸 피해. */
function resolveSelfMitigated(p: RiotParticipant): number | undefined {
  return typeof p.damageSelfMitigated === 'number' ? p.damageSelfMitigated : undefined
}

/**
 * 적을 묶은 횟수. challenges 는 오래된 응답에 통째로 없을 수 있어 optional
 * chaining 으로 읽고, 없으면 undefined 를 준다 (CC 축이 지속시간만 쓴다).
 */
function resolveHardCcCount(p: RiotParticipant): number | undefined {
  const value = p.challenges?.enemyChampionImmobilizations
  return typeof value === 'number' ? value : undefined
}

// ─── Main Sync Logic ──────────────────────────────────────────────────────────

export async function syncNewGames(): Promise<{ synced: number; skipped: number }> {
  const supabase = createServerClient()
  const championRoles = await fetchChampionRoles()

  // Ensure players exist in DB. 한 번의 upsert 로 4행을 함께 보낸다.
  await supabase.from('players').upsert(
    TRACKED_PLAYERS.map((player) => ({
      puuid: player.puuid,
      game_name: player.gameName,
      tag_line: player.tagLine,
    })),
    { onConflict: 'puuid' },
  )

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
      // CC 필드명을 먼저 통일해 두면 점수 계산과 저장이 같은 값을 본다.
      const allParticipants = info.participants.map((p) => ({
        ...p,
        totalTimeCCDealt: resolveCcDealt(p),
        totalShieldsOnTeammates: resolveShieldsOnTeammates(p),
        damageSelfMitigated: resolveSelfMitigated(p),
        hardCcCount: resolveHardCcCount(p),
      }))
      const trackedInMatch = allParticipants.filter((p) =>
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

      // Calculate perf scores for tracked players (one pass over the match)
      const matchScores = calcTeamPerfScores(trackedInMatch, {
        durationSeconds: info.gameDuration,
        roles: championRoles,
      })
      const perfScores = trackedInMatch.map((p) => ({
        puuid: p.puuid,
        perf: matchScores.get(p.puuid) ?? 0,
      }))

      // 4인 결과를 한 번의 insert 로 보낸다. 행마다 왕복하면 경기당 4회가 된다.
      const resultRows = trackedInMatch
        .map((p) => {
          const playerId = playerIdMap.get(p.puuid)
          if (!playerId) return null
          const perf = perfScores.find((ps) => ps.puuid === p.puuid)?.perf ?? 0
          return {
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
            heals_on_teammates: resolveHealsOnTeammates(p) ?? null,
            shields_on_teammates: resolveShieldsOnTeammates(p) ?? null,
            damage_self_mitigated: resolveSelfMitigated(p) ?? null,
            hard_cc_count: resolveHardCcCount(p) ?? null,
            gold_earned: p.goldEarned,
            // allParticipants 에서 이미 리졸버를 거친 값이다.
            cc_score: p.totalTimeCCDealt,
            augment_ids: extractAugmentIds(p),
            perf_score: Math.round(perf * 10) / 10,
          }
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)

      const { error: resultsError } = await supabase.from('game_results').insert(resultRows)
      if (resultsError) {
        // 결과 없는 게임 행이 남으면 다음 동기화가 "이미 저장됨"으로 건너뛴다.
        console.error(`Failed to insert results for ${matchId}:`, resultsError)
        await supabase.from('games').delete().eq('id', gameRow.id)
        continue
      }

      synced++
    } catch (err) {
      console.error(`Error processing match ${matchId}:`, err)
    }
  }

  return { synced, skipped }
}
