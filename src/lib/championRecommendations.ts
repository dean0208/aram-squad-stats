import type { ChampionCatalogEntry } from './championNames'

interface PlayedChampionReport {
  champion_name: string
  games: number
  avg_perf_score: number
}

export interface ChampionRecommendation {
  championId: string
  championName: string
  reason: string
}

const ROLE_PREFERRED: Record<string, string[]> = {
  Tank: ['Malphite', 'Maokai', 'Ornn', 'Sion', 'Zac', 'TahmKench', 'ChoGath', 'Shen'],
  Fighter: ['Wukong', 'Sett', 'Aatrox', 'Darius', 'Gwen', 'Volibear', 'Renekton'],
  Mage: ['Hwei', 'Brand', 'Swain', 'Viktor', 'Xerath', 'Syndra', 'Zyra'],
  Marksman: ['Jinx', 'KogMaw', 'Varus', 'Sivir', 'Smolder', 'Aphelios', 'Ashe'],
  Support: ['Seraphine', 'Sona', 'Karma', 'Janna', 'Nami', 'Milio', 'RenataGlasc'],
  Assassin: ['KhaZix', 'Akali', 'Katarina', 'Fizz', 'Evelynn', 'Zed', 'Talon'],
}

const STYLE_NOTES: Record<string, string> = {
  Malphite: '궁극기로 한타를 먼저 열고 방어력으로 진입 후 버티는',
  Maokai: '묘목 포킹과 궁극기 속박으로 지역을 통제하는',
  Ornn: '긴 사거리 이니시와 최대 체력 비례 피해로 앞을 여는',
  Wukong: '분신으로 진입각을 만들고 궁극기로 다수를 띄우는',
  Hwei: '긴 사거리 광역 스킬로 먼저 체력을 깎는',
  Brand: '광역 스킬 연계로 좁은 라인에 지속 피해를 넣는',
  Jinx: '안전한 사거리에서 지속 딜을 쌓고 리셋을 노리는',
  KogMaw: '앞라인을 녹이는 지속 딜과 사거리로 싸우는',
  Seraphine: '광역 CC와 보호막으로 아군의 한타를 완성하는',
  Sona: '광역 회복·버프로 긴 교전을 유리하게 만드는',
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
    .sort((a, b) => b.avg_perf_score - a.avg_perf_score)[0]
  if (!anchor) return null

  const anchorChampion = catalog.find(champion => champion.id === anchor.champion_name)
  const anchorTags = new Set(anchorChampion?.tags ?? [])
  const role = Object.keys(ROLE_PREFERRED).find(roleName => anchorTags.has(roleName))
    ?? anchorChampion?.tags[0]
    ?? '비슷한 역할'
  const candidates = catalog.filter(champion => (played.get(champion.id)?.games ?? 0) < 3)
  if (!candidates.length) return null

  const ranked = candidates
    .map(champion => {
      const report = played.get(champion.id)
      const roleMatch = champion.tags.some(tag => anchorTags.has(tag)) ? 100 : 0
      const preferredIndex = role && ROLE_PREFERRED[role]
        ? ROLE_PREFERRED[role].indexOf(champion.id)
        : -1
      const styleMatch = preferredIndex >= 0 ? 60 - preferredIndex : 0
      const observedScore = report?.avg_perf_score ?? anchor.avg_perf_score
      const similarity = Math.max(0, 30 - Math.abs(observedScore - anchor.avg_perf_score))
      return {
        champion,
        games: report?.games ?? 0,
        score: roleMatch + styleMatch + similarity - (report?.games ?? 0),
        preferredIndex,
      }
    })
    .sort((a, b) => b.score - a.score || a.preferredIndex - b.preferredIndex || a.games - b.games || a.champion.name.localeCompare(b.champion.name))

  const selected = ranked[0]
  const roleLabel = ROLE_NAMES[role] ?? '비슷한 역할'
  const styleNote = STYLE_NOTES[selected.champion.id]
  const tacticalReason = styleNote
    ? `${styleNote} 챔피언이에요.`
    : `${selected.champion.tags.map(tag => ROLE_NAMES[tag] ?? tag).join('·')} 특성을 가진 챔피언이에요.`
  const reason = selected.games > 0
    ? `${anchorChampion?.name ?? anchor.champion_name}에서 좋은 기록을 남겼네요. ${selected.champion.name}도 뽑을 기회가 생기면 다시 해봐요. ${tacticalReason}`
    : `${anchorChampion?.name ?? anchor.champion_name}에서 좋은 기록을 남겼네요. 아직 기록이 없는 ${roleLabel} ${selected.champion.name}도 뽑히면 도전! ${tacticalReason}`

  return {
    championId: selected.champion.id,
    championName: selected.champion.name,
    reason,
  }
}
