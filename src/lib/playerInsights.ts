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
    details.push(`${role}인데 최근 딜량이 팀 평균의 ${Math.round((avgDamage / avgTeamDamage) * 100)}%예요. 스킬을 아끼기보다 먼저 포킹하고 교전 때 꾸준히 딜을 넣어보세요.`)
  } else if (avgDamage > avgTeamDamage * 1.25) {
    details.push(`최근 딜량이 팀 평균보다 ${Math.round((avgDamage / avgTeamDamage - 1) * 100)}% 높아요. 지금처럼 딜각을 잡되, 무리한 추격만 조심하면 됩니다.`)
  }

  if (['원딜', '암살자', '마법사', '브루저'].includes(role) && avgAssists > Math.max(2, avgKills * 2.2)) {
    details.push(`어시는 충분한데 킬보다 ${avgAssists.toFixed(1)}개씩 앞서요. 딜러 포지션답게 마지막 체력 정리와 킬각까지 조금 더 노려보세요.`)
  }

  if (avgDeaths > avgTeamDeaths * 1.35) {
    details.push(role === '탱커'
      ? `최근 데스가 팀 평균보다 많아요. 진입 직후 바로 녹지 않게 주요 스킬을 한 박자 아끼고, 궁 연계 후 빠질 생존 수단을 남겨보세요.`
      : `최근 데스가 팀 평균보다 많아요. 먼저 들어가기보다 상대 핵심 스킬이 빠진 뒤 움직여 생존부터 챙겨보세요.`)
  }

  if (avgPerf < 45) {
    details.push('최근 성능 지수가 낮은 편이에요. 한타 전에 포킹·시야·스킬 적중 중 하나라도 확실히 챙기면 퍼포먼스가 올라갑니다.')
  }

  if (!details.length) {
    details.push(`최근 평균 성능 ${Math.round(avgPerf)}점으로 흐름은 안정적이에요. 지금 플레이를 유지하면서 교전 타이밍만 조금 더 과감하게 잡아보세요.`)
  }

  return { headline: `최근 ${count}경기 분석`, details: details.slice(0, 3) }
}