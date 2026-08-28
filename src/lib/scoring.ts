export interface ScoreParticipant {
  puuid: string
  teamId: number
  win: boolean
  kills: number
  assists: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  totalHeal: number
  totalTimeCCDealt: number
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

    const score =
      killParticipation * 25 +
      damageShare * 20 +
      damageTakenShare * 15 +
      healingShare * 15 +
      ccShare * 20 +
      (participant.win ? 5 : 0)

    scores.set(participant.puuid, Math.round(Math.min(100, score) * 10) / 10)
  }

  return scores
}
