import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeGame } from '../src/lib/normalized.ts'

const result = (id, player = true) => ({
  id,
  champion_name: 'Jinx', champion_id: 222, kills: 1, deaths: 2, assists: 3,
  damage_dealt: 100, damage_taken: 200, healing: 0, gold_earned: 300, cc_score: 4,
  perf_score: 50, contribution_score: 50, augment_ids: [],
  players: player ? { puuid: `p-${id}`, game_name: `p-${id}`, tag_line: 'OC' } : null,
})

test('저장 게임을 정규화하고 네 명 미만이면 PARTIAL로 표시한다', () => {
  const normalized = normalizeGame({
    id: 'g1', match_id: 'OC1_1', played_at: '2026-08-29T15:00:00Z',
    duration_seconds: 1200, our_team_win: true, our_team_id: 100,
    game_results: [result('1'), result('2')],
  })

  assert.equal(normalized.gameStartedAtUtc, '2026-08-29T15:00:00.000Z')
  assert.equal(normalized.result, 'WIN')
  assert.equal(normalized.dataQuality, 'PARTIAL')
  assert.equal(normalized.teamKills, null)
})

test('원본에 없는 파생 필드는 null로 유지하고 추측하지 않는다', () => {
  const normalized = normalizeGame({
    id: 'g2', match_id: 'OC1_2', played_at: 'invalid',
    duration_seconds: 0, our_team_win: false, our_team_id: 100,
    game_results: [result('1', false), result('2'), result('3'), result('4')],
  })

  assert.equal(normalized.dataQuality, 'INVALID')
  assert.equal(normalized.damageMitigated, undefined)
  assert.equal(normalized.patch, null)
  assert.equal(normalized.sourceUpdatedAtUtc, null)
})