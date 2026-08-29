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

test('딜량이 돋보인 승리는 실제 딜 플레이를 언급한다', () => {
  const line = getGameCommentary({
    game_id: 'damage-game',
    our_team_win: true,
    game_results: [
      result('딜장인', { contribution: 90, damage: 120000 }),
      result('허개굴', { contribution: 60, damage: 50000 }),
    ],
  })

  assert.match(line, /딜장인님/)
  assert.match(line, /딜|딜량|포킹/)
})

test('같은 기여 유형도 경기 seed에 따라 다른 문장을 고른다', () => {
  const game = {
    our_team_win: true,
    game_results: [
      result('째지', { contribution: 80, assists: 18 }),
      result('허개굴', { contribution: 60, assists: 5 }),
    ],
  }

  const first = getGameCommentary({ ...game, game_id: 'assist-game-a' })
  const second = getGameCommentary({ ...game, game_id: 'assist-game-b' })

  assert.notEqual(first, second)
  assert.match(first, /째지님/)
  assert.match(second, /째지님/)
})
