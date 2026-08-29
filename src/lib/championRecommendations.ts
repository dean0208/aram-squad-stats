import type { ChampionCatalogEntry } from './championNames'

interface PlayedChampionReport {
  champion_name: string
  games: number
  avg_perf_score: number
  avg_contribution_score: number
}

export interface ChampionRecommendation {
  championId: string
  championName: string
  reason: string
}

const ROLE_NAMES: Record<string, string> = {
  Assassin: '암살자',
  Fighter: '브루저',
  Mage: '마법사',
  Marksman: '원딜',
  Support: '서포터',
  Tank: '탱커',
}

export function recommendChampion(
  reports: PlayedChampionReport[],
  catalog: ChampionCatalogEntry[],
): ChampionRecommendation | null {
  if (!reports.length || !catalog.length) return null

  const played = new Map(reports.map(report => [report.champion_name, report]))
  const anchor = [...reports]
    .filter(report => report.games >= 3)
    .sort((a, b) => b.avg_contribution_score - a.avg_contribution_score)[0]
  if (!anchor) return null

  const anchorChampion = catalog.find(champion => champion.id === anchor.champion_name)
  const anchorTags = new Set(anchorChampion?.tags ?? [])
  const candidates = catalog.filter(champion => (played.get(champion.id)?.games ?? 0) < 3)
  if (!candidates.length) return null

  const ranked = candidates
    .map(champion => {
      const report = played.get(champion.id)
      const roleMatch = champion.tags.some(tag => anchorTags.has(tag)) ? 100 : 0
      const observedContribution = report?.avg_contribution_score ?? anchor.avg_contribution_score
      const similarity = Math.max(0, 30 - Math.abs(observedContribution - anchor.avg_contribution_score))
      return {
        champion,
        games: report?.games ?? 0,
        score: roleMatch + similarity - (report?.games ?? 0),
      }
    })
    .sort((a, b) => b.score - a.score || a.games - b.games || a.champion.name.localeCompare(b.champion.name))

  const selected = ranked[0]
  const role = anchorChampion?.tags.map(tag => ROLE_NAMES[tag]).find(Boolean) ?? '비슷한 역할'
  const reason = selected.games > 0
    ? `${anchorChampion?.name ?? anchor.champion_name}에서 좋은 모습을 보여서, ${role}인 ${selected.champion.name}도 잘 맞아 보여요.`
    : `${anchorChampion?.name ?? anchor.champion_name}에서 좋은 모습을 보여서, 아직 안 해본 ${role} ${selected.champion.name}도 잘 맞아 보여요.`

  return {
    championId: selected.champion.id,
    championName: selected.champion.name,
    reason,
  }
}
