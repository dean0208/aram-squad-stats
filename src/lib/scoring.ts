export interface ScoreParticipant {
  puuid: string
  championName?: string
  teamId: number
  win: boolean
  kills: number
  assists: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  totalHeal: number
  totalTimeCCDealt: number
}

type Role = 'carry' | 'tank' | 'support' | 'mage' | 'assassin' | 'fighter'

const ROLE_CHAMPIONS: Record<Role, Set<string>> = {
  carry: new Set(['Jinx', 'KogMaw', 'Varus', 'Sivir', 'Smolder', 'Aphelios', 'Ashe', 'Caitlyn', 'Draven']),
  tank: new Set(['Malphite', 'Maokai', 'Ornn', 'Sion', 'Zac', 'TahmKench', 'ChoGath', 'Shen', 'Rammus', 'Amumu']),
  support: new Set(['Seraphine', 'Sona', 'Karma', 'Janna', 'Nami', 'Milio', 'RenataGlasc', 'Soraka']),
  mage: new Set(['Hwei', 'Brand', 'Swain', 'Viktor', 'Xerath', 'Syndra', 'Zyra', 'Lux', 'Ahri']),
  assassin: new Set(['KhaZix', 'Akali', 'Katarina', 'Fizz', 'Evelynn', 'Zed', 'Talon']),
  fighter: new Set(['Wukong', 'Sett', 'Aatrox', 'Darius', 'Gwen', 'Volibear', 'Renekton', 'Garen']),
}

const ROLE_WEIGHTS: Record<Role, [number, number, number, number, number]> = {
  carry: [25, 35, 8, 5, 22],
  tank: [15, 12, 30, 10, 28],
  support: [15, 10, 12, 30, 28],
  mage: [20, 30, 8, 10, 27],
  assassin: [32, 30, 8, 5, 20],
  fighter: [24, 25, 18, 8, 20],
}

function getRole(championName?: string): Role | null {
  if (!championName) return null
  return (Object.keys(ROLE_CHAMPIONS) as Role[]).find(role => ROLE_CHAMPIONS[role].has(championName)) ?? null
}

function share(value: number, total: number): number {
  return total > 0 ? value / total : 0
}

/**
 * Scores each player on a continuous 0-100 scale.
 * Team-relative shares give utility players credit without rewarding raw volume alone.
 */
export function calculateFairScores(participants: ScoreParticipant[]): Map<string, number> {
  const scores = new Map<string, number>()

  for (const participant of participants) {
    const teammates = participants.filter(p => p.teamId === participant.teamId)
    const teamKda = teammates.reduce((sum, p) => sum + p.kills + p.assists, 0)
    const teamDamage = teammates.reduce((sum, p) => sum + p.totalDamageDealtToChampions, 0)
    const teamTaken = teammates.reduce((sum, p) => sum + p.totalDamageTaken, 0)
    const teamHealing = teammates.reduce((sum, p) => sum + p.totalHeal, 0)
    const teamCc = teammates.reduce((sum, p) => sum + p.totalTimeCCDealt, 0)

    const killParticipation = share(participant.kills + participant.assists, teamKda)
    const damageShare = share(participant.totalDamageDealtToChampions, teamDamage)
    const damageTakenShare = share(participant.totalDamageTaken, teamTaken)
    const healingShare = share(participant.totalHeal, teamHealing)
    const ccShare = share(participant.totalTimeCCDealt, teamCc)
    const [killWeight, damageWeight, takenWeight, healingWeight, ccWeight] =
      ROLE_WEIGHTS[getRole(participant.championName) ?? 'fighter']

    const score =
      killParticipation * killWeight +
      damageShare * damageWeight +
      damageTakenShare * takenWeight +
      healingShare * healingWeight +
      ccShare * ccWeight +
      (participant.win ? 5 : 0)

    scores.set(participant.puuid, Math.round(Math.min(100, score) * 10) / 10)
  }

  return scores
}
