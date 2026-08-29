import { DDRAGON_BASE } from './config'

export type ChampionNameMap = Record<string, string>

export interface ChampionCatalogEntry {
  id: string
  name: string
  tags: string[]
}

export async function fetchChampionCatalog(): Promise<ChampionCatalogEntry[]> {
  try {
    const response = await fetch(`${DDRAGON_BASE}/data/ko_KR/champion.json`, {
      next: { revalidate: 86400 },
    })
    const data = await response.json()
    return Object.values(data.data) as ChampionCatalogEntry[]
  } catch {
    return []
  }
}

export async function fetchChampionNames(): Promise<ChampionNameMap> {
  const catalog = await fetchChampionCatalog()
  return Object.fromEntries(catalog.map(champion => [champion.id, champion.name]))
}

export function getChampionDisplayName(name: string, names: ChampionNameMap): string {
  return names[name] ?? name
}
