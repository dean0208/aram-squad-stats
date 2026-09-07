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
  return toChampionNameMap(await fetchChampionCatalog())
}

export function getChampionDisplayName(name: string, names: ChampionNameMap): string {
  return names[name] ?? name
}

// ─── 역할 라벨 ────────────────────────────────────────────────────────────────

export type DamageType = 'AD' | 'AP' | 'Tank' | 'Utility'

export interface ChampionRoleLabel {
  label: string
  emoji: string
  damageType: DamageType
}

export type ChampionRoleLabelMap = Record<string, ChampionRoleLabel>

/** DDragon 태그 → 화면에 쓰는 한국어 역할. */
const TAG_KO: Record<string, ChampionRoleLabel> = {
  Marksman: { label: '원딜',   emoji: '🏹', damageType: 'AD' },
  Mage:     { label: '마법사', emoji: '🔮', damageType: 'AP' },
  Tank:     { label: '탱커',   emoji: '🛡️', damageType: 'Tank' },
  Fighter:  { label: '브루저', emoji: '⚡', damageType: 'AD' },
  Support:  { label: '서포터', emoji: '💊', damageType: 'Utility' },
  Assassin: { label: '암살자', emoji: '🗡️', damageType: 'AD' },
}

const TAG_PRIORITY = ['Marksman', 'Mage', 'Assassin', 'Fighter', 'Tank', 'Support']

export const FALLBACK_ROLE_LABEL: ChampionRoleLabel = { label: '올라운더', emoji: '⚡', damageType: 'Utility' }

/**
 * 카탈로그 한 번으로 이름과 역할을 모두 만든다.
 * 예전에는 홈이 en_US 카탈로그를 따로 한 번 더 받아 같은 매핑을 다시 만들었다.
 */
export function toChampionNameMap(catalog: ChampionCatalogEntry[]): ChampionNameMap {
  return Object.fromEntries(catalog.map(champion => [champion.id, champion.name]))
}

export function toChampionRoleLabels(catalog: ChampionCatalogEntry[]): ChampionRoleLabelMap {
  const map: ChampionRoleLabelMap = {}
  for (const champion of catalog) {
    const tag = TAG_PRIORITY.find(candidate => champion.tags?.includes(candidate)) ?? champion.tags?.[0]
    map[champion.id] = TAG_KO[tag ?? ''] ?? FALLBACK_ROLE_LABEL
  }
  return map
}
