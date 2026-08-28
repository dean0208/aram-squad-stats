export interface ChampionContribution {
  name: string
  count: number
  totalContribution: number
}

export interface RankedChampion {
  name: string
  avgContribution: number
}

export function rankContributionChampions(
  champions: ChampionContribution[],
  minGames = 3,
): { best: RankedChampion | null; worst: RankedChampion | null } {
  const eligible = champions
    .filter(({ count }) => count >= minGames)
    .map((champion) => ({
      ...champion,
      average: champion.totalContribution / champion.count,
    }))

  if (eligible.length === 0) return { best: null, worst: null }

  const best = eligible.reduce((current, champion) =>
    champion.average > current.average ? champion : current,
  )
  const worst = eligible.reduce((current, champion) =>
    champion.average < current.average ? champion : current,
  )

  return {
    best: {
      name: best.name,
      avgContribution: Math.round(best.average),
    },
    worst: worst.name === best.name
      ? null
      : {
          name: worst.name,
          avgContribution: Math.round(worst.average),
        },
  }
}
