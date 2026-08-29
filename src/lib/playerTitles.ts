export interface PlayerTitleStats {
  puuid: string
  role: string
  avgDamage: number
  avgTaken: number
  avgHealing: number
  avgCc: number
  avgAssist: number
}

export interface PlayerTitle {
  label: string
  emoji: string
}

const TITLES = {
  marksman: { label: '구마유시세요?', emoji: '🏹' },
  tank: { label: '맷집왕', emoji: '🛡️' },
  healer: { label: '힐장인', emoji: '💊' },
  cc: { label: 'CC 지배자', emoji: '🌀' },
  assist: { label: '어시왕', emoji: '🤝' },
  steady: { label: '든든한 전력', emoji: '⚡' },
} satisfies Record<string, PlayerTitle>

export function assignPlayerTitles(players: PlayerTitleStats[]): Map<string, PlayerTitle> {
  const maxDamage = Math.max(...players.map(player => player.avgDamage), 0)
  const maxTaken = Math.max(...players.map(player => player.avgTaken), 0)
  const maxHealing = Math.max(...players.map(player => player.avgHealing), 0)
  const maxCc = Math.max(...players.map(player => player.avgCc), 0)
  const maxAssist = Math.max(...players.map(player => player.avgAssist), 0)
  const titles = new Map<string, PlayerTitle>()

  for (const player of players) {
    const candidates = [
      { key: 'marksman', ratio: player.role === '원딜' ? player.avgDamage / maxDamage : 0 },
      { key: 'tank', ratio: player.avgTaken / maxTaken },
      { key: 'healer', ratio: player.avgHealing / maxHealing },
      { key: 'cc', ratio: player.avgCc / maxCc },
      { key: 'assist', ratio: player.avgAssist / maxAssist },
    ]
    const strongest = candidates.sort((a, b) => b.ratio - a.ratio)[0]
    titles.set(player.puuid, strongest.ratio >= 0.75 ? TITLES[strongest.key as keyof typeof TITLES] : TITLES.steady)
  }

  return titles
}
