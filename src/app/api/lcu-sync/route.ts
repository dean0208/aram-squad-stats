import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { TRACKED_PLAYERS, DDRAGON_BASE } from '@/lib/config'
import { calcPerfScore, calcContributionScore } from '@/lib/riot'
import type { RiotParticipant } from '@/lib/riot'
import { resolveTrackedParticipants } from '@/lib/lcuSyncMapping'

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

    // upsert 직후 실제 DB ID를 다시 읽어 결과 저장에 사용한다.
    const { data: refreshedPlayerRows } = await supabase
      .from('players')
      .select('id, puuid')
      .in('puuid', TRACKED_PLAYERS.map((p) => p.puuid))
    playerIdMap.clear()
    for (const row of refreshedPlayerRows ?? []) playerIdMap.set(row.puuid, row.id)
    if (playerIdMap.size !== TRACKED_PLAYERS.length) {
      return Response.json({ synced: 0, skipped: body.games.length, errors: ['4명 플레이어 ID를 모두 확인하지 못했습니다.'] })
    }

    // 이미 저장된 match_id 목록
    const incomingIds = body.games.map((g) => g.gameId)
    const { data: existing } = await supabase
      .from('games')
      .select('id, match_id')
      .in('match_id', incomingIds)
    const existingByMatchId = new Map((existing ?? []).map((g) => [g.match_id, g.id]))

    const TRACKED_PUUID_SET = new Set(TRACKED_PLAYERS.map((p) => p.puuid))
    // gameName → Riot PUUID 매핑 (LCU puuid는 다른 포맷이라 gameName으로 조회)
    const gameNameToPuuid = new Map(TRACKED_PLAYERS.map((p) => [p.gameName, p.puuid]))

    let synced = 0
    let skipped = 0
    const errors: string[] = []

    for (const game of body.games) {
      // 4명 모두 서로 다른 고정 Riot PUUID로 확인
      const tracked = resolveTrackedParticipants(game.participants, TRACKED_PLAYERS)
      if (!tracked) { skipped++; continue }

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

      // 기존 게임은 결과가 비어 있을 때만 복구하고, 결과가 있으면 건너뛴다.
      const existingGameId = existingByMatchId.get(game.gameId)
      let gameRow: { id: string } | null = existingGameId ? { id: existingGameId } : null
      if (existingGameId) {
        const { count, error: countError } = await supabase
          .from('game_results')
          .select('id', { count: 'exact', head: true })
          .eq('game_id', existingGameId)
        if (countError) { errors.push(`${game.gameId}: ${countError.message}`); continue }
        if ((count ?? 0) > 0) { skipped++; continue }
      } else {
        const { data: insertedGame, error: gameErr } = await supabase
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
        if (gameErr || !insertedGame) {
          errors.push(`${game.gameId}: ${gameErr?.message ?? '게임 저장 실패'}`)
          continue
        }
        gameRow = insertedGame
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
        if (!playerId) {
          errors.push(`${game.gameId}: ${p.puuid} 플레이어 ID 누락`)
          continue
        }

        const lcuP = participants.find((x) => x.puuid === p.puuid)!
        const perf = perfScores.find((ps) => ps.puuid === p.puuid)?.perf ?? 0
        const contribution = calcContributionScore(p.puuid, perfScores)

        const { error: resultError } = await supabase.from('game_results').insert({
          game_id: gameRow!.id,
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
        if (resultError) errors.push(`${game.gameId}: ${resultError.message}`)
      }

      const { count: savedResultCount } = await supabase
        .from('game_results')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameRow!.id)
      if ((savedResultCount ?? 0) !== tracked.length) {
        if (!existingGameId) await supabase.from('games').delete().eq('id', gameRow!.id)
        errors.push(`${game.gameId}: 4명 결과 저장 불완전 (${savedResultCount ?? 0}/${tracked.length})`)
        continue
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
