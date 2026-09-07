import { NextRequest } from 'next/server'
import { RIOT_BASE, TRACKED_PLAYERS, DATA_START_DATE, SUPPORTED_QUEUES } from '@/lib/config'

/**
 * 진단 전용. 호출마다 Riot API를 여러 번 쓰므로 공개해두면 누구나 레이트 리밋을
 * 소진시킬 수 있어 동기화와 동일한 시크릿으로 잠근다.
 *
 * 두 계열의 엔드포인트를 같은 키로 나란히 때려 본다. 한쪽만 실패하면 원인이
 * 키가 아니라 그 계열에 있다는 뜻이다 — 백필이 match-detail 에서만 403 을
 * 받던 상황을 가르기 위해 만들었다.
 *
 * `?matchId=OC1_...` 를 주면 그 경기를 직접 읽어 본다.
 */

export const maxDuration = 30

/** Riot 응답에서 원인 판별에 쓸 헤더만 추린다. */
function diagnostics(res: Response): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of [
    'x-rate-limit-type',
    'retry-after',
    'x-app-rate-limit',
    'x-app-rate-limit-count',
  ]) {
    const value = res.headers.get(name)
    if (value) out[name] = value
  }
  return out
}

async function probe(url: string, headers: HeadersInit) {
  // 캐시를 타면 "지금" 키가 유효한지 알 수 없다. 진단은 항상 실물로 때린다.
  const res = await fetch(url, { headers, cache: 'no-store' })
  const text = await res.text()
  let parsed: unknown = null
  try { parsed = JSON.parse(text) } catch { /* 본문이 JSON 이 아니면 그대로 둔다 */ }
  return {
    status: res.status,
    headers: diagnostics(res),
    body: Array.isArray(parsed) ? { count: parsed.length, sample: parsed.slice(0, 3) } : parsed,
  }
}

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.LCU_SYNC_SECRET ?? ''
  const providedSecret = request.headers.get('x-lcu-sync-secret') ?? ''
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const headers = { 'X-Riot-Token': process.env.RIOT_API_KEY ?? '' }
  const puuid = TRACKED_PLAYERS[0].puuid
  const matchId = request.nextUrl.searchParams.get('matchId')

  const results: Record<string, unknown> = {
    riotBase: RIOT_BASE,
    apiKeySet: !!process.env.RIOT_API_KEY,
    apiKeyLength: (process.env.RIOT_API_KEY ?? '').length,
    dataStartDate: DATA_START_DATE.toISOString(),
    supportedQueues: SUPPORTED_QUEUES,
  }

  // ① 계정 계열: 이 PUUID 를 키가 알아보는가
  results.account = await probe(
    `${RIOT_BASE}/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`,
    headers,
  )

  // ② 매치 목록 계열: 큐 필터 없이 / 있이
  results.idsNoFilter = await probe(
    `${RIOT_BASE}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=5`,
    headers,
  )
  results.idsMayhem = await probe(
    `${RIOT_BASE}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=2400&count=5`,
    headers,
  )

  // ③ 매치 상세 계열: 목록에서 갓 받은 id 와, 호출자가 지정한 id
  const listed = (results.idsNoFilter as { body?: { sample?: string[] } }).body?.sample ?? []
  if (listed.length > 0) {
    results.detailFromList = {
      matchId: listed[0],
      ...(await probe(`${RIOT_BASE}/lol/match/v5/matches/${listed[0]}`, headers)),
    }
  }
  if (matchId) {
    // 지역 클러스터가 갈리면 같은 경기라도 한쪽에서만 200 이 나온다.
    // 어느 라우팅이 이 경기를 아는지 넷 다 때려 본다.
    const routings = ['sea', 'americas', 'europe', 'asia']
    const perRouting: Record<string, { status: number; ok: boolean }> = {}
    for (const routing of routings) {
      const r = await probe(
        `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        headers,
      )
      perRouting[routing] = { status: r.status, ok: r.status === 200 }
    }
    results.detailRequested = { matchId, perRouting }
  }

  return Response.json(results)
}
