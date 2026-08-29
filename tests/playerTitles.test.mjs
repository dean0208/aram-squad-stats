import assert from 'node:assert/strict'
import test from 'node:test'

import { assignPlayerTitles } from '../src/lib/playerTitles.ts'

test('원딜 중심 플레이어에게 원딜 타이틀을 붙인다', () => {
  const titles = assignPlayerTitles([
    { puuid: 'marksman', role: '원딜', avgDamage: 90, avgTaken: 20, avgHealing: 5, avgCc: 5, avgAssist: 8 },
    { puuid: 'tank', role: '탱커', avgDamage: 30, avgTaken: 90, avgHealing: 5, avgCc: 5, avgAssist: 8 },
  ])

  assert.equal(titles.get('marksman')?.label, '구마유시세요?')
  assert.equal(titles.get('tank')?.label, '맷집왕')
})

test('강점 데이터가 없으면 기본 타이틀을 붙인다', () => {
  const titles = assignPlayerTitles([
    { puuid: 'steady', role: '올라운더', avgDamage: 0, avgTaken: 0, avgHealing: 0, avgCc: 0, avgAssist: 0 },
  ])

  assert.equal(titles.get('steady')?.label, '든든한 전력')
})
