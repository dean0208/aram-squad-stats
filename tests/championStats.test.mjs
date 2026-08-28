import assert from 'node:assert/strict'
import test from 'node:test'

import { rankContributionChampions } from '../src/lib/championStats.ts'

test('기여도 평균이 가장 높은 챔피언과 가장 낮은 챔피언을 고른다', () => {
  const champions = [
    { name: 'Jinx', count: 4, totalContribution: 320 },
    { name: 'Lulu', count: 3, totalContribution: 270 },
    { name: 'Garen', count: 5, totalContribution: 250 },
  ]

  assert.deepEqual(rankContributionChampions(champions), {
    best: { name: 'Lulu', avgContribution: 90 },
    worst: { name: 'Garen', avgContribution: 50 },
  })
  assert.deepEqual(champions.map(({ name }) => name), ['Jinx', 'Lulu', 'Garen'])
})

test('3판 미만 챔피언은 순위에서 제외한다', () => {
  assert.deepEqual(rankContributionChampions([
    { name: 'Jinx', count: 2, totalContribution: 200 },
    { name: 'Lulu', count: 3, totalContribution: 240 },
  ]), {
    best: { name: 'Lulu', avgContribution: 80 },
    worst: null,
  })
})
