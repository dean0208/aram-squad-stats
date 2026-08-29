import assert from 'node:assert/strict'
import test from 'node:test'

import { recommendChampion } from '../src/lib/championRecommendations.ts'

test('잘했던 챔피언과 같은 역할의 3판 미만 챔피언을 추천한다', () => {
  const recommendation = recommendChampion([
    { champion_name: 'Lux', games: 5, avg_perf_score: 25, avg_contribution_score: 25 },
    { champion_name: 'Ahri', games: 4, avg_perf_score: 18, avg_contribution_score: 18 },
  ], [
    { id: 'Lux', name: '럭스', tags: ['Mage'] },
    { id: 'Ahri', name: '아리', tags: ['Mage'] },
    { id: 'Syndra', name: '신드라', tags: ['Mage'] },
    { id: 'Garen', name: '가렌', tags: ['Fighter'] },
  ])

  assert.equal(recommendation?.championId, 'Syndra')
  assert.equal(recommendation?.championName, '신드라')
})

test('모든 챔피언을 많이 해봤으면 추천하지 않는다', () => {
  assert.equal(recommendChampion([
    { champion_name: 'Lux', games: 3, avg_perf_score: 20, avg_contribution_score: 20 },
  ], [
    { id: 'Lux', name: '럭스', tags: ['Mage'] },
  ]), null)
})

test('탱커 플레이어에게 가렌보다 전투 개시형 탱커를 우선 추천한다', () => {
  const recommendation = recommendChampion([
    { champion_name: 'Ornn', games: 5, avg_perf_score: 70, avg_contribution_score: 70 },
  ], [
    { id: 'Ornn', name: '오른', tags: ['Tank', 'Fighter'] },
    { id: 'Garen', name: '가렌', tags: ['Fighter', 'Tank'] },
    { id: 'Malphite', name: '말파이트', tags: ['Tank', 'Fighter'] },
  ])

  assert.equal(recommendation?.championId, 'Malphite')
  assert.match(recommendation?.reason ?? '', /전투 개시|한타|탱커/)
})
