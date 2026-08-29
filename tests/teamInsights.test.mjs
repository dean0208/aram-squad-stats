import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyzeTeamComposition,
  getBestChampionComposition,
  getBestRoleByPlayer,
} from '../src/lib/teamInsights.ts'

test('탱커와 AD가 부족한 조합의 문제를 분석한다', () => {
  const insights = analyzeTeamComposition({
    win: false,
    members: [
      { championName: '럭스', damageType: 'AP' },
      { championName: '제라스', damageType: 'AP' },
      { championName: '소나', damageType: 'Utility' },
      { championName: '잔나', damageType: 'Utility' },
    ],
  })

  assert.match(insights.join(' '), /탱커|앞라인/)
  assert.match(insights.join(' '), /AD|물리|딜러/)
})

test('가장 승률이 높은 4인 챔피언 조합을 집계한다', () => {
  const best = getBestChampionComposition([
    { win: true, members: [{ playerId: 'a', championName: '럭스' }, { playerId: 'b', championName: '진' }] },
    { win: false, members: [{ playerId: 'a', championName: '럭스' }, { playerId: 'b', championName: '진' }] },
    { win: true, members: [{ playerId: 'a', championName: '말파이트' }, { playerId: 'b', championName: '징크스' }] },
    { win: true, members: [{ playerId: 'a', championName: '말파이트' }, { playerId: 'b', championName: '징크스' }] },
    { win: false, members: [{ playerId: 'a', championName: '말파이트' }, { playerId: 'b', championName: '징크스' }] },
  ])

  assert.deepEqual(best?.champions, ['말파이트', '징크스'])
  assert.equal(best?.wins, 2)
  assert.equal(best?.games, 3)
})

test('3경기 미만인 조합은 최고 조합 후보에서 제외한다', () => {
  const best = getBestChampionComposition([
    { win: true, members: [{ playerId: 'a', championName: '가렌' }] },
    { win: true, members: [{ playerId: 'a', championName: '가렌' }] },
  ])
  assert.equal(best, null)
})

test('플레이어별 역할 팀 승률을 계산한다', () => {
  const best = getBestRoleByPlayer([
    ...Array.from({ length: 9 }, () => ({ win: false, members: [{ playerId: 'interest', role: '원딜' }] })),
    { win: true, members: [{ playerId: 'interest', role: '탱커' }] },
    ...Array.from({ length: 9 }, () => ({ win: true, members: [{ playerId: 'interest', role: '탱커' }] })),
  ])

  assert.equal(best.get('interest')?.role, '탱커')
  assert.equal(best.get('interest')?.winRate, 100)
})

test('10경기 미만인 포지션은 최고 포지션 후보에서 제외한다', () => {
  const best = getBestRoleByPlayer(
    Array.from({ length: 9 }, () => ({ win: true, members: [{ playerId: 'interest', role: '원딜' }] })),
  )
  assert.equal(best.has('interest'), false)
})