export interface TrackedIdentity {
  gameName: string
  puuid: string
}

export interface LcuIdentityParticipant {
  gameName?: string
  puuid: string
  teamId: number
}

export function resolveTrackedParticipants<T extends LcuIdentityParticipant>(
  participants: T[],
  tracked: TrackedIdentity[],
): Array<T & { puuid: string }> | null {
  const byName = new Map(tracked.map(player => [player.gameName, player.puuid]))
  const resolved = participants
    .filter(participant => participant.gameName && byName.has(participant.gameName))
    .map(participant => ({
      participant,
      riotPuuid: byName.get(participant.gameName!)!,
    }))
  const unique = new Map<string, T>()
  for (const item of resolved) unique.set(item.riotPuuid, item.participant)
  if (resolved.length !== tracked.length || unique.size !== tracked.length) return null
  return tracked
    .map(player => {
      const participant = unique.get(player.puuid)
      return participant ? { ...participant, puuid: player.puuid } : null
    })
    .filter((participant): participant is T & { puuid: string } => participant !== null)
}
