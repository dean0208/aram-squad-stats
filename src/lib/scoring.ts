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
  totalHeal: number
  totalTimeCCDealt: number
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
 * 가중치만으로는 역할 간 균형이 맞지 않았다. 누적 211경기 실측에서 탱커의
 * 평균 지분이 1.25 였고(피해흡수 92k vs 원딜 37k), 결과적으로 탱커가 전체
 * 평균보다 8점 높고 마법사·암살자가 3~4점 낮았다. 챔피언 선택이 아니라
 * 플레이가 점수에 남도록 역할별로 눈금을 맞춘다.
 *
 * 표본이 적은 역할(서포터·암살자)은 보정하지 않는다.
 * 픽 성향이 크게 바뀌면 다시 계산해야 한다 — README 의 재계산 절차 참고.
 */
const ROLE_CALIBRATION: Record<Role, number> = {
  carry: 1.07,
  mage: 0.96,
  assassin: 1,
  fighter: 1.07,
  tank: 1.23,
  support: 1,
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
      healing: acc.healing + p.totalHeal,
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

    const relativeIndex =
      share(p.kills + p.assists, totals.kda) * killWeight +
      share(p.totalDamageDealtToChampions, totals.damage) * damageWeight +
      share(p.totalDamageTaken, totals.taken) * takenWeight +
      share(p.totalHeal, totals.healing) * healingWeight +
      share(p.totalTimeCCDealt, totals.cc) * ccWeight

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
    const rawRelative = effectiveWeight > 0 ? relativeIndex / (effectiveWeight * fairShare) : 1
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
