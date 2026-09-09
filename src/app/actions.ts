'use server'

import { updateTag } from 'next/cache'
import { GAMES_CACHE_TAG } from '@/lib/games'

/** LCU 에이전트가 저장한 기록을 다시 읽는다. Riot API는 호출하지 않는다. */
export async function refreshGamesAction(): Promise<void> {
  updateTag(GAMES_CACHE_TAG)
}
