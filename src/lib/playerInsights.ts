export interface RecentGameSnapshot {
  champion: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  damage: number
  teamDamageAverage: number
  teamAssistsAverage: number
  teamDeathsAverage: number
  perf: number
}

export interface RecentFiveAnalysis {
  headline: string
  details: string[]
}

export function analyzeRecentFiveGames(
  snapshots: RecentGameSnapshot[],
  role: string,
): RecentFiveAnalysis {
  if (!snapshots.length) {
    return { headline: '최근 5경기 기록이 아직 없어요', details: ['게임을 더 플레이하면 세부 분석을 보여드릴게요.'] }
  }

  const count = snapshots.length
  const avg = (key: keyof RecentGameSnapshot) =>
    snapshots.reduce((sum, snapshot) => sum + Number(snapshot[key]), 0) / count
  const avgDamage = avg('damage')
  const avgTeamDamage = avg('teamDamageAverage')
  const avgKills = avg('kills')
  const avgAssists = avg('assists')
  const avgDeaths = avg('deaths')
  const avgTeamDeaths = avg('teamDeathsAverage')
  const avgPerf = avg('perf')
  const details: string[] = []

  if (avgDamage < avgTeamDamage * 0.75) {
    details.push(`최근 딜량이 우리 4인 평균의 ${Math.round((avgDamage / avgTeamDamage) * 100)}%예요. 챔피언 역할과 함께 보면 더 잘 이해할 수 있어요.`)
  } else if (avgDamage > avgTeamDamage * 1.25) {
    details.push(`최근 딜량이 우리 4인 평균보다 ${Math.round((avgDamage / avgTeamDamage - 1) * 100)}% 높아요. 딜량으로 존재감을 남겼네요.`)
  }

  if (['원딜', '암살자', '마법사', '브루저'].includes(role) && avgAssists > Math.max(2, avgKills * 2.2)) {
    details.push(`최근 평균 ${avgKills.toFixed(1)}킬 · ${avgAssists.toFixed(1)}어시스트. 어시가 킬보다 ${(avgAssists - avgKills).toFixed(1)}개 많았어요.`)
  }

  if (avgDeaths > avgTeamDeaths * 1.35) {
    details.push(`최근 평균 ${avgDeaths.toFixed(1)}데스로 우리 4인 평균 ${avgTeamDeaths.toFixed(1)}회보다 많았어요. 생존 흐름은 위의 경기 기록에서 돌아보세요.`)
  }

  if (avgPerf < 45) {
    details.push(`최근 평균 기여도 ${Math.round(avgPerf)}점. 어떤 픽에서 점수가 달랐는지 도감에서 비교해보세요.`)
  }

  if (!details.length) {
    details.push(`최근 평균 기여도는 ${Math.round(avgPerf)}점이에요. 경기별 점수를 눌러 이번 기록을 돌아보세요.`)
  }

  return { headline: `최근 ${count}경기 분석`, details: details.slice(0, 3) }
}
