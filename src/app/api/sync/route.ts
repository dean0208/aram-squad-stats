import { revalidateTag } from 'next/cache'
import { syncNewGames } from '@/lib/riot'
import { GAMES_CACHE_TAG } from '@/lib/games'

export async function GET() {
  try {
    const result = await syncNewGames()
    // 동기화 직후 페이지를 새로고침하므로 stale 응답 없이 즉시 만료시킨다.
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
