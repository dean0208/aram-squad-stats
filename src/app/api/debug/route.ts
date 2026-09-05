import { NextRequest } from 'next/server'
import { RIOT_BASE, TRACKED_PLAYERS, DATA_START_DATE } from '@/lib/config'

// ARAM Mayhem. 예전에는 Swiftplay(480)가 하드코딩되어 있어 실제 수집 큐와 달랐다.
const DEBUG_QUEUE_ID = 2400

/**
 * 진단 전용. 호출마다 Riot API를 2번 쓰므로 공개해두면 누구나 레이트 리밋을
 * 소진시킬 수 있어 동기화와 동일한 시크릿으로 잠근다.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.LCU_SYNC_SECRET ?? ''
  const providedSecret = request.headers.get('x-lcu-sync-secret') ?? ''
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const headers = { 'X-Riot-Token': process.env.RIOT_API_KEY ?? '' }
  const puuid = TRACKED_PLAYERS[0].puuid

  const url = `${RIOT_BASE}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${DEBUG_QUEUE_ID}&count=5`

  const res = await fetch(url, { headers })
  const matches = await res.json()

  // Check first match date
  let firstMatchInfo = null
  if (Array.isArray(matches) && matches.length > 0) {
    const detailRes = await fetch(
      `${RIOT_BASE}/lol/match/v5/matches/${matches[0]}`,
      { headers }
    )
    const detail = await detailRes.json()
    const ts = detail?.info?.gameStartTimestamp
    firstMatchInfo = {
      matchId: matches[0],
      date: ts ? new Date(ts).toISOString() : null,
      afterFilter: ts ? new Date(ts) >= DATA_START_DATE : false,
      queueId: detail?.info?.queueId,
    }
  }

  return Response.json({
    riotBase: RIOT_BASE,
    apiKeySet: !!process.env.RIOT_API_KEY,
    dataStartDate: DATA_START_DATE.toISOString(),
    fetchUrl: url,
    fetchStatus: res.status,
    matchCount: Array.isArray(matches) ? matches.length : 0,
    matches: Array.isArray(matches) ? matches : matches,
    firstMatchInfo,
  })
}
