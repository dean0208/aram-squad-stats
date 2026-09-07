export type Role = 'carry' | 'tank' | 'support' | 'mage' | 'assassin' | 'fighter'

export type ChampionRoleMap = Record<string, Role>

export const DEFAULT_ROLE: Role = 'fighter'

/**
 * DDragon 태그를 못 받아왔을 때만 쓰는 최소 폴백.
 * 예전에는 이 목록이 유일한 판정 수단이라 실제 픽의 32%만 맞췄다.
 */
export const FALLBACK_ROLES: ChampionRoleMap = {
  Jinx: 'carry', KogMaw: 'carry', Varus: 'carry', Sivir: 'carry', Ashe: 'carry',
  Caitlyn: 'carry', Draven: 'carry', Aphelios: 'carry', Smolder: 'carry',
  Malphite: 'tank', Maokai: 'tank', Ornn: 'tank', Sion: 'tank', Zac: 'tank',
  TahmKench: 'tank', ChoGath: 'tank', Shen: 'tank', Rammus: 'tank', Amumu: 'tank',
  Seraphine: 'support', Sona: 'support', Karma: 'support', Janna: 'support',
  Nami: 'support', Milio: 'support', RenataGlasc: 'support', Soraka: 'support',
  Hwei: 'mage', Brand: 'mage', Swain: 'mage', Viktor: 'mage', Xerath: 'mage',
  Syndra: 'mage', Zyra: 'mage', Lux: 'mage', Ahri: 'mage',
  KhaZix: 'assassin', Akali: 'assassin', Katarina: 'assassin', Fizz: 'assassin',
  Evelynn: 'assassin', Zed: 'assassin', Talon: 'assassin',
  Wukong: 'fighter', Sett: 'fighter', Aatrox: 'fighter', Darius: 'fighter',
  Gwen: 'fighter', Volibear: 'fighter', Renekton: 'fighter', Garen: 'fighter',
}

/** DDragon 태그 → 역할. */
const TAG_ROLE: Record<string, Role> = {
  Marksman: 'carry',
  Mage: 'mage',
  Assassin: 'assassin',
  Fighter: 'fighter',
  Tank: 'tank',
  Support: 'support',
}

/**
 * DDragon 태그에서 대표 역할을 고른다.
 *
 * 첫 태그가 그 챔피언의 주 역할이다. 예전에는 고정 우선순위표
 * (Marksman → Mage → … → Support) 로 골랐는데, Support 가 맨 뒤라
 * 야나·소라카·밀리오·나미·질리언이 전부 mage 로 분류됐다. 최근 30경기에서
 * 서포터로 잡힌 픽이 0건이었고, 등장 챔피언 67종 중 21종이 잘못된 역할을
 * 받고 있었다 (초가스·갈리오 → mage, 사이온·문도 → fighter).
 *
 * 예외는 하나다. Support 와 Tank 를 함께 단 챔피언(탐 켄치·브라움·알리스타)은
 * 칼바람에서 앞라인으로 서므로 탱커로 본다.
 *
 * 태그를 읽어 오는 쪽(championRoles.ts)이 아니라 여기에 두는 이유는, 그쪽이
 * DDragon fetch 를 물고 있어 테스트에서 직접 import 할 수 없기 때문이다.
 */
export function roleFromTags(tags: string[] | undefined): Role {
  const primary = TAG_ROLE[tags?.[0] ?? ''] ?? DEFAULT_ROLE
  if (primary === 'support' && tags?.includes('Tank')) return 'tank'
  return primary
}

export function resolveRole(championName: string | undefined, roles: ChampionRoleMap): Role {
  if (!championName) return DEFAULT_ROLE
  return roles[championName] ?? FALLBACK_ROLES[championName] ?? DEFAULT_ROLE
}

export interface ScoreParticipant {
  puuid: string
  championName?: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  /** Riot 의 totalHeal. 물약·흡혈 같은 자힐이 섞여 있다. */
  totalHeal: number
  /**
   * 팀원에게 준 힐만. 수집 이전 경기는 undefined 라 totalHeal 로 폴백한다.
   *
   * 자힐이 섞인 totalHeal 을 쓰면 탱커·전사가 자기를 회복한 양까지 팀 힐
   * 합계에 들어가, 실제로 팀을 살린 서포터의 지분이 희석된다.
   */
  totalHealsOnTeammates?: number
  totalTimeCCDealt: number
}

/**
 * 힐 축에 쓸 값. 팀원 힐을 알면 그것만 쓰고, 모르면 예전처럼 totalHeal.
 *
 * 한 경기의 4인은 같은 동기화에서 들어오므로 분자와 분모가 항상 같은 기준을
 * 쓴다. 옛 경기와 새 경기가 서로 다른 기준인 것은 감수한다 — 과거는 원본이
 * 없어 백필할 수 없다.
 */
export function healingForScore(p: ScoreParticipant): number {
  return p.totalHealsOnTeammates ?? p.totalHeal
}

export interface ScoreOptions {
  /** 분당 지표 계산용. 없으면 30분으로 본다. */
  durationSeconds?: number
  /** championName → 역할. 없으면 내장 폴백만 쓴다. */
  roles?: ChampionRoleMap
}

/** 지분 가중치: [킬관여, 딜, 피해흡수, 힐, CC] · 합 100 */
const ROLE_WEIGHTS: Record<Role, [number, number, number, number, number]> = {
  carry: [26, 37, 8, 5, 24],
  tank: [16, 13, 31, 10, 30],
  support: [16, 11, 12, 31, 30],
  mage: [21, 32, 8, 10, 29],
  assassin: [34, 32, 8, 5, 21],
  fighter: [25, 26, 19, 8, 22],
}

/**
 * 역할별 통상 지분 수준. 계산된 지분을 이 값으로 나눠 1.0(=팀 평균)에 맞춘다.
 *
 * 가중치만으로는 역할 간 균형이 맞지 않는다. 챔피언 선택이 아니라 플레이가
 * 점수에 남도록 역할별로 눈금을 맞춘다.
 *
 * 누적 221경기에 반복 대입해 여섯 역할의 평균이 전체 평균과 ±0.1점 안에서
 * 만나도록 맞춘 값이다 (역할별 표본 31~270건). 이전 값은 서포터가 mage 로
 * 잘못 분류되던 시절에 뽑은 것이라 눈금 자체가 틀어져 있었다.
 *
 * 픽 성향이 크게 바뀌면 다시 계산해야 한다 — README 의 재계산 절차 참고.
 */
const ROLE_CALIBRATION: Record<Role, number> = {
  carry: 1.02,
  mage: 0.91,
  assassin: 0.96,
  fighter: 0.94,
  tank: 1.12,
  support: 1.06,
}

// ── 모델 상수 ────────────────────────────────────────────────────────────────
// 실제 누적 경기 표본에서 뽑은 기준값과, 0-100 분포가 고르게 퍼지도록 맞춘 계수.
// 조정 시 점수 의미가 바뀌므로 저장된 점수를 반드시 재계산해야 한다.

/** 절대 성과 기준: 플레이어 1인당 분당 딜 중앙값. */
const DPM_REFERENCE = 1900
/** 절대 성과 기준: 팀 (킬+어시)/데스 중앙값. */
const TEAM_KDA_REFERENCE = 3.4
/** 한 판의 절대 성과가 점수를 지배하지 않도록 하는 상한 배수. */
const ABSOLUTE_CAP = 2.0
/** 개인 지분과 팀 절대 성과의 배합. */
const RELATIVE_WEIGHT = 0.8
/** 배합 결과 1.0(=평균 수준)을 몇 점으로 볼지. */
const BASE_POINTS = 57
/**
 * 한 축에서 인정하는 지분 상한 (제 몫의 몇 배까지).
 *
 * 지분은 팀 합계로 나눈 값이라 한 사람이 독점할 수 있는 축에서는 위로 열려
 * 있다. 특히 힐은 소라카 한 명이 팀 힐의 70%를 가져가는 일이 흔해서, 서포터
 * 가중치(힐 31)와 곱해지면 다른 축을 전부 덮어썼다 — 보정 전 실측에서 소라카
 * 99.2점이 나왔다. 잘한 판을 눌러 버리지 않으면서 한 축의 독점이 점수를
 * 지배하지는 못하도록 제 몫의 2배에서 끊는다.
 */
const AXIS_SHARE_CAP = 2.0

/** 데스 지분이 제 몫보다 많을 때 깎는 최대 폭. */
const DEATH_PENALTY = 18
/** 승리 가산점. */
const WIN_BONUS = 5

const DEFAULT_DURATION_SECONDS = 1800

function share(value: number, total: number): number {
  return total > 0 ? value / total : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 한 경기에 참여한 추적 플레이어들의 0-100 점수를 계산한다.
 *
 * 세 축을 합친다.
 *  - 개인 지분: 팀 내에서 얼마나 많은 몫을 했는가 (역할별 가중치)
 *  - 팀 절대 성과: 이 판 자체가 통상 수준 대비 어땠는가
 *  - 데스 지분: 제 몫보다 많이 죽었으면 감점
 *
 * 지분만 쓰면 팀 내 합이 1로 고정되어 "넷 다 잘한 날"과 "넷 다 던진 날"이
 * 구분되지 않으므로 팀 절대 성과를 섞는다.
 */
export function calculateFairScores(
  participants: ScoreParticipant[],
  options: ScoreOptions = {},
): Map<string, number> {
  const scores = new Map<string, number>()
  if (participants.length === 0) return scores

  const minutes = Math.max(1, (options.durationSeconds ?? DEFAULT_DURATION_SECONDS) / 60)
  const roles = options.roles ?? {}
  const fairShare = 1 / participants.length

  const totals = participants.reduce(
    (acc, p) => ({
      kda: acc.kda + p.kills + p.assists,
      damage: acc.damage + p.totalDamageDealtToChampions,
      taken: acc.taken + p.totalDamageTaken,
      healing: acc.healing + healingForScore(p),
      cc: acc.cc + p.totalTimeCCDealt,
      deaths: acc.deaths + p.deaths,
    }),
    { kda: 0, damage: 0, taken: 0, healing: 0, cc: 0, deaths: 0 },
  )

  // 절대 성과는 팀 단위로 잰다. 개인 딜량을 쓰면 탱커·서포터가 역할 때문에
  // 구조적으로 손해를 보므로, 이 항은 "이 판 자체가 좋았는가"만 담당한다.
  const teamDamagePerMinute = totals.damage / minutes / participants.length
  const teamKda = totals.kda / Math.max(1, totals.deaths)
  const absolute =
    0.6 * Math.min(ABSOLUTE_CAP, teamDamagePerMinute / DPM_REFERENCE) +
    0.4 * Math.min(ABSOLUTE_CAP, teamKda / TEAM_KDA_REFERENCE)

  for (const p of participants) {
    const role = resolveRole(p.championName, roles)
    const [killWeight, damageWeight, takenWeight, healingWeight, ccWeight] = ROLE_WEIGHTS[role]

    // 각 축을 "제 몫의 몇 배" 로 환산해 상한을 건 뒤 가중치를 곱한다.
    const axis = (value: number, total: number): number =>
      total > 0 ? Math.min(share(value, total) / fairShare, AXIS_SHARE_CAP) : 0

    const relativeIndex =
      axis(p.kills + p.assists, totals.kda) * killWeight +
      axis(p.totalDamageDealtToChampions, totals.damage) * damageWeight +
      axis(p.totalDamageTaken, totals.taken) * takenWeight +
      axis(healingForScore(p), totals.healing) * healingWeight +
      axis(p.totalTimeCCDealt, totals.cc) * ccWeight

    // 팀 합계가 0인 지표는 분모에서도 뺀다.
    // 어떤 지표가 수집되지 않는 구간이 생겨도 점수 눈금이 흔들리지 않게 하려는 것.
    // (CC 는 실제로 오래 0으로 저장되어 있었다)
    const effectiveWeight =
      (totals.kda > 0 ? killWeight : 0) +
      (totals.damage > 0 ? damageWeight : 0) +
      (totals.taken > 0 ? takenWeight : 0) +
      (totals.healing > 0 ? healingWeight : 0) +
      (totals.cc > 0 ? ccWeight : 0)

    // 1.0 = 팀 평균만큼 기여. 역할별 눈금 차이를 마지막에 보정한다.
    const rawRelative = effectiveWeight > 0 ? relativeIndex / effectiveWeight : 1
    const relative = rawRelative / ROLE_CALIBRATION[role]

    // 제 몫(fairShare)만큼 죽으면 0, 두 배로 죽으면 +1
    const deathPenalty = clamp((share(p.deaths, totals.deaths) - fairShare) / fairShare, -1, 1.5)

    const score =
      BASE_POINTS * (RELATIVE_WEIGHT * relative + (1 - RELATIVE_WEIGHT) * absolute) -
      DEATH_PENALTY * deathPenalty +
      (p.win ? WIN_BONUS : 0)

    scores.set(p.puuid, Math.round(clamp(score, 0, 100) * 10) / 10)
  }

  return scores
}
