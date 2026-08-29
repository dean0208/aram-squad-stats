import assert from 'node:assert/strict'
import test from 'node:test'

import { getGameCommentary } from '../src/lib/gameCommentary.ts'

const result = (name, stats) => ({
  name,
  contribution_score: stats.contribution ?? 50,
  damage_dealt: stats.damage ?? 0,
  damage_taken: stats.taken ?? 0,
  healing: stats.healing ?? 0,
  assists: stats.assists ?? 0,
  cc_score: stats.cc ?? 0,
})

test('승리한 게임은 가장 돋보인 기여 요인을 칭찬한다', () => {
  const line = getGameCommentary({
    our_team_win: true,
    game_results: [
      result('째지', { contribution: 80, taken: 90000 }),
      result('허개굴', { contribution: 60, damage: 50000 }),
    ],
  })

  assert.match(line, /째지님/)
  assert.match(line, /탱킹/)
})

test('패배한 게임은 최저 기여자를 유쾌하게 언급한다', () => {
  const line = getGameCommentary({
    our_team_win: false,
    game_results: [
      result('째지', { contribution: 70 }),
      result('권선비', { contribution: 20 }),
    ],
  })

  assert.match(line, /권선비님/)
  assert.match(line, /아쉬워/)
})
