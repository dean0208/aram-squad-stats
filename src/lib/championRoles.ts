import { fetchDDragonBase } from './ddragon'
import { roleFromTags, type ChampionRoleMap } from './scoring'

/**
 * DDragon 태그에서 챔피언 → 역할 맵을 만든다.
 * 실패하면 빈 맵을 돌려주고, 판정은 scoring 의 내장 폴백이 맡는다.
 */
export async function fetchChampionRoles(): Promise<ChampionRoleMap> {
  try {
    const base = await fetchDDragonBase()
    const res = await fetch(`${base}/data/en_US/champion.json`, { next: { revalidate: 86400 } })
    if (!res.ok) return {}
    const data = await res.json()
    const map: ChampionRoleMap = {}
    for (const champ of Object.values(data.data) as { id: string; tags: string[] }[]) {
      map[champ.id] = roleFromTags(champ.tags)
    }
    return map
  } catch {
    return {}
  }
}

/** championId → championName. 신규 챔피언 이름 복구에 쓴다. */
export async function fetchChampionIdToName(): Promise<Record<number, string>> {
  try {
    const base = await fetchDDragonBase()
    const res = await fetch(`${base}/data/en_US/champion.json`, { next: { revalidate: 86400 } })
    if (!res.ok) return {}
    const data = await res.json()
    const map: Record<number, string> = {}
    for (const champ of Object.values(data.data) as { key: string; id: string }[]) {
      map[parseInt(champ.key, 10)] = champ.id
    }
    return map
  } catch {
    return {}
  }
}
