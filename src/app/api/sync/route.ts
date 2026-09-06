import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { syncNewGames } from '@/lib/riot'
import { GAMES_CACHE_TAG } from '@/lib/games'

/**
 * 스케줄러 전용 동기화 경로.
 *
 * 인증이 없던 동안에는 이 URL 을 치는 것만으로 Riot API 를 소모시킬 수
 * 있었다. 대시보드 버튼은 서버 액션(`app/actions.ts`)으로 옮겼으므로
 * 여기는 시크릿을 요구해도 된다.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.SYNC_SECRET ?? ''
  const providedSecret = request.headers.get('x-sync-secret') ?? ''
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncNewGames()
    if (result.synced > 0) revalidateTag(GAMES_CACHE_TAG, { expire: 0 })
    return Response.json(result)
  } catch (err) {
    console.error('Sync error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
