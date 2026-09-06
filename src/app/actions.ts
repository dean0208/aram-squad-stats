'use server'

import { revalidateTag } from 'next/cache'
import { syncNewGames } from '@/lib/riot'
import { GAMES_CACHE_TAG } from '@/lib/games'

/**
 * 대시보드 동기화 버튼용.
 *
 * 예전에는 버튼이 공개 GET /api/sync 를 호출해서, 누구나 그 URL 을 치는
 * 것만으로 Riot API 쿼터를 소모시킬 수 있었다. 서버 액션은 고정된 공개
 * URL 이 없고 Next 가 오리진을 검사하므로 그 경로를 없앤다.
 *
 * 이 앱에는 로그인이 없어 진짜 인증은 아니다. 스케줄러가 쓰는 경로는
 * /api/sync 에서 시크릿으로 따로 잠근다.
 */
export async function syncGamesAction(): Promise<{ synced: number; skipped: number }> {
  const result = await syncNewGames()
  if (result.synced > 0) revalidateTag(GAMES_CACHE_TAG, { expire: 0 })
  return result
}
