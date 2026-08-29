import { DDRAGON_BASE } from './config'

export type ChampionNameMap = Record<string, string>

export async function fetchChampionNames(): Promise<ChampionNameMap> {
  try {
    const response = await fetch(`${DDRAGON_BASE}/data/ko_KR/champion.json`, {
      next: { revalidate: 86400 },
    })
    const data = await response.json()
    const names: ChampionNameMap = {}
    for (const champion of Object.values(data.data) as { id: string; name: string }[]) {
      names[champion.id] = champion.name
    }
    return names
  } catch {
    return {}
  }
}

export function getChampionDisplayName(name: string, names: ChampionNameMap): string {
  return names[name] ?? name
}
