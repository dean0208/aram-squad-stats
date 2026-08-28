import { RIOT_BASE, TRACKED_PLAYERS, DATA_START_DATE } from '@/lib/config'

export async function GET() {
  const headers = { 'X-Riot-Token': process.env.RIOT_API_KEY ?? '' }
  const puuid = TRACKED_PLAYERS[0].puuid

  const url = `${RIOT_BASE}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=480&count=5`

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
