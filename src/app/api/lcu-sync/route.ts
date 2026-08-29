import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { TRACKED_PLAYERS, DDRAGON_BASE } from '@/lib/config'
import { calcPerfScore, calcContributionScore } from '@/lib/riot'
import type { RiotParticipant } from '@/lib/riot'

// ─── Types (LCU normalized payload) ──────────────────────────────────────────

interface LcuParticipant {
  puuid: string
  gameName?: string
  championId: number
  championName: string   // agent가 DDragon으로 변환해서 보냄, 없으면 ""
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  totalHeal: number
  goldEarned: number
  totalTimeCCDealt: number
  augments: number[]     // augment IDs (없으면 [])
  itemIds?: number[]      // completed item IDs (없으면 [])
}

interface LcuGame {
  gameId: string         // "OC1_709110934" 형식
  queueId: number        // 2400
  gameCreation: number   // unix ms
  gameDuration: number   // seconds
  participants: LcuParticipant[]
}

interface LcuSyncPayload {
  secret: string
  games: LcuGame[]
}

// ─── DDragon champion ID → name 매핑 ─────────────────────────────────────────

let champMap: Record<number, string> | null = null

async function getChampMap(): Promise<Record<number, string>> {
  if (champMap) return champMap
  try {
    const res = await fetch(`${DDRAGON_BASE}/data/en_US/champion.json`, { next: { revalidate: 86400 } })
    const data = await res.json()
    const map: Record<number, string> = {}
    for (const champ of Object.values(data.data) as { key: string; id: string }[]) {
      map[parseInt(champ.key)] = champ.id
    }
    champMap = map
    return map
  } catch {
    return {}
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LcuSyncPayload

    // 인증
    const secret = process.env.LCU_SYNC_SECRET ?? ''
    if (!secret || body.secret !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const champNames = await getChampMap()

    // 플레이어 rows 확보
    const { data: playerRows } = await supabase
      .from('players')
      .select('id, puuid')
      .in('puuid', TRACKED_PLAYERS.map((p) => p.puuid))

    const playerIdMap = new Map<string, string>()
    for (const row of playerRows ?? []) playerIdMap.set(row.puuid, row.id)

    // players upsert (없을 경우 대비)
    for (const p of TRACKED_PLAYERS) {
      await supabase.from('players').upsert(
        { puuid: p.puuid, game_name: p.gameName, tag_line: p.tagLine },
        { onConflict: 'puuid' },
      )
    }

    // 이미 저장된 match_id 목록
    const incomingIds = body.games.map((g) => g.gameId)
    const { data: existing } = await supabase
      .from('games')
      .select('match_id')
      .in('match_id', incomingIds)
    const existingSet = new Set((existing ?? []).map((g) => g.match_id))

    const TRACKED_PUUID_SET = new Set(TRACKED_PLAYERS.map((p) => p.puuid))
    // gameName → Riot PUUID 매핑 (LCU puuid는 다른 포맷이라 gameName으로 조회)
    const gameNameToPuuid = new Map(TRACKED_PLAYERS.map((p) => [p.gameName, p.puuid]))

    let synced = 0
    let skipped = 0
    const errors: string[] = []

    for (const game of body.games) {
      if (existingSet.has(game.gameId)) { skipped++; continue }

      // 4명 모두 있는지 gameName 기준으로 확인
      const tracked = game.participants.filter((p) =>
        gameNameToPuuid.has(p.gameName ?? '')
      )
      if (tracked.length < TRACKED_PLAYERS.length) { skipped++; continue }

      // LCU puuid → Riot puuid 변환 (gameName 경유)
      const participants = game.participants.map((p) => ({
        ...p,
        puuid: gameNameToPuuid.get(p.gameName ?? '') ?? p.puuid,
        championName: p.championName || champNames[p.championId] || `Champion${p.championId}`,
      }))

      // 변환된 tracked participants (Riot PUUID 기준)
      const trackedParticipants = participants.filter((p) => TRACKED_PUUID_SET.has(p.puuid))

      // RiotParticipant 형태로 변환 (점수 계산용)
      const riotParts: RiotParticipant[] = participants.map((p) => ({
        puuid: p.puuid,
        championId: p.championId,
        championName: p.championName,
        teamId: p.teamId,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        totalDamageDealtToChampions: p.totalDamageDealtToChampions,
        totalDamageTaken: p.totalDamageTaken,
        totalHeal: p.totalHeal,
        totalTimeCCDealt: p.totalTimeCCDealt,
        goldEarned: p.goldEarned,
      }))

      // 우리 팀 판별 (Riot PUUID로 변환된 participants 기준)
      const teamCounts = new Map<number, number>()
      for (const p of trackedParticipants) teamCounts.set(p.teamId, (teamCounts.get(p.teamId) ?? 0) + 1)
      const ourTeamId = [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const ourTeamWin = trackedParticipants.find((p) => p.teamId === ourTeamId)?.win ?? false

      // game 삽입
      const { data: gameRow, error: gameErr } = await supabase
        .from('games')
        .insert({
          match_id: game.gameId,
          played_at: new Date(game.gameCreation).toISOString(),
          duration_seconds: game.gameDuration,
          our_team_win: ourTeamWin,
          our_team_id: ourTeamId,
        })
        .select('id')
        .single()

      if (gameErr || !gameRow) {
        errors.push(`${game.gameId}: ${gameErr?.message}`)
        continue
      }

      // 점수 계산
      const trackedParts = riotParts.filter((p) => TRACKED_PUUID_SET.has(p.puuid))
      const perfScores = trackedParts.map((p) => ({
        puuid: p.puuid,
        perf: calcPerfScore(p, riotParts),
      }))

      // game_results 삽입
      for (const p of trackedParts) {
        const playerId = playerIdMap.get(p.puuid)
        if (!playerId) continue

        const lcuP = participants.find((x) => x.puuid === p.puuid)!
        const perf = perfScores.find((ps) => ps.puuid === p.puuid)?.perf ?? 0
        const contribution = calcContributionScore(p.puuid, perfScores)

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
          augment_ids: lcuP.augments ?? [],
          item_ids: lcuP.itemIds ?? [],
          perf_score: Math.round(perf * 10) / 10,
          contribution_score: contribution,
        })
      }

      synced++
    }

    return Response.json({ synced, skipped, errors })
  } catch (err) {
    console.error('LCU sync error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
