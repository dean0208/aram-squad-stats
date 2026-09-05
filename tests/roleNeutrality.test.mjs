import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateFairScores } from '../src/lib/scoring.ts'

/**
 * 누적 211경기에서 뽑은 역할별 평균 프로필.
 * 각 역할이 "제 역할대로 평균만큼" 했을 때 점수가 비슷해야 한다.
 * 그렇지 않으면 점수가 플레이가 아니라 챔피언 선택을 반영하는 것이다.
 */
const TYPICAL = {
  carry:   { champion: 'Jinx',     kills: 16, deaths: 12, assists: 25, damage: 59158, taken: 36601, healing: 7986 },
  mage:    { champion: 'Lux',      kills: 10, deaths: 11, assists: 31, damage: 42122, taken: 41102, healing: 9897 },
  tank:    { champion: 'Malphite', kills: 8,  deaths: 12, assists: 31, damage: 33579, taken: 92316, healing: 19492 },
  fighter: { champion: 'Garen',    kills: 10, deaths: 13, assists: 26, damage: 45233, taken: 83337, healing: 23829 },
}

const ROLES = { Jinx: 'carry', Lux: 'mage', Malphite: 'tank', Garen: 'fighter' }

const roster = Object.entries(TYPICAL).map(([key, p]) => ({
  puuid: key,
  championName: p.champion,
  win: true,
  kills: p.kills,
  deaths: p.deaths,
  assists: p.assists,
  totalDamageDealtToChampions: p.damage,
  totalDamageTaken: p.taken,
  totalHeal: p.healing,
  totalTimeCCDealt: 0,
}))

test('역할별로 평균만큼 하면 점수가 비슷하게 나온다', () => {
  const scores = calculateFairScores(roster, { durationSeconds: 1500, roles: ROLES })
  const values = [...scores.values()]
  const spread = Math.max(...values) - Math.min(...values)

  assert.ok(spread <= 6,
    `역할 간 격차가 ${spread.toFixed(1)}점. 보정 전에는 12점이 넘었다. 상세: ${JSON.stringify([...scores])}`)
})

test('딜이 낮은 탱커가 딜 많은 원딜보다 크게 낮지 않다', () => {
  const scores = calculateFairScores(roster, { durationSeconds: 1500, roles: ROLES })

  assert.ok(scores.get('tank') >= scores.get('carry') - 4,
    `탱커 ${scores.get('tank')} vs 원딜 ${scores.get('carry')} — 탱커는 딜량이 절반이어도 흡수로 상쇄돼야 한다`)
})

test('같은 역할 안에서는 잘한 쪽이 확실히 높다', () => {
  const good = calculateFairScores([
    { puuid: 'good', championName: 'Malphite', win: false, kills: 10, deaths: 6, assists: 40,
      totalDamageDealtToChampions: 50000, totalDamageTaken: 140000, totalHeal: 30000, totalTimeCCDealt: 0 },
    { puuid: 'bad', championName: 'Ornn', win: false, kills: 2, deaths: 18, assists: 8,
      totalDamageDealtToChampions: 12000, totalDamageTaken: 40000, totalHeal: 4000, totalTimeCCDealt: 0 },
  ], { durationSeconds: 1500, roles: { Malphite: 'tank', Ornn: 'tank' } })

  assert.ok(good.get('good') - good.get('bad') > 20,
    `같은 탱커끼리는 변별력이 있어야 한다: ${good.get('good')} vs ${good.get('bad')}`)
})
