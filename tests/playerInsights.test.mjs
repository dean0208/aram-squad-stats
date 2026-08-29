import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeRecentFiveGames } from '../src/lib/playerInsights.ts'

const snapshot = (overrides = {}) => ({
  champion: 'Jinx',
  win: true,
  kills: 2,
  deaths: 3,
  assists: 12,
  damage: 30000,
  teamDamageAverage: 60000,
  teamAssistsAverage: 8,
  teamDeathsAverage: 2,
  perf: 45,
  ...overrides,
})

test('최근 5경기에서 원딜의 낮은 딜량과 어시스트 편중을 함께 짚는다', () => {
  const analysis = analyzeRecentFiveGames(
    Array.from({ length: 5 }, () => snapshot()),
    '원딜',
  )

  assert.match(analysis.headline, /최근 5경기/)
  assert.match(analysis.details.join(' '), /딜량/)
  assert.match(analysis.details.join(' '), /킬|딜러/) 
})

test('탱커의 높은 데스와 낮은 성능을 생존 중심 조언으로 연결한다', () => {
  const analysis = analyzeRecentFiveGames(
    Array.from({ length: 5 }, () => snapshot({
      champion: 'Malphite',
      deaths: 7,
      teamDeathsAverage: 3,
      perf: 35,
      damage: 45000,
      teamDamageAverage: 40000,
    })),
    '탱커',
  )

  assert.match(analysis.details.join(' '), /데스|생존/)
  assert.match(analysis.details.join(' '), /진입|궁|생존/)
})