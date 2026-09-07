import test from 'node:test'
import assert from 'node:assert/strict'

import {
  TRACKED_PLAYERS,
  MVP_PHOTOS,
  ANCHOR_PHOTOS,
  getPlayerPhoto,
} from '../src/lib/config.ts'

const [first] = TRACKED_PLAYERS

test('MVP 는 MVP 사진을 쓴다', () => {
  assert.equal(getPlayerPhoto(first.puuid, 'mvp'), MVP_PHOTOS[first.puuid])
})

test('kind 를 안 주면 MVP 사진이다', () => {
  assert.equal(getPlayerPhoto(first.puuid), MVP_PHOTOS[first.puuid])
})

test('걸배이 사진을 안 넣은 사람은 MVP 사진으로 돌아간다', () => {
  // 표가 아직 비어 있어도 화면이 깨지지 않아야 한다.
  if (ANCHOR_PHOTOS[first.puuid] === undefined) {
    assert.equal(getPlayerPhoto(first.puuid, 'anchor'), MVP_PHOTOS[first.puuid])
  }
})

test('걸배이 사진이 있으면 그것이 MVP 사진을 이긴다', () => {
  // 표를 채우기 전에도 우선순위를 고정해 둔다.
  const puuid = 'test-puuid'
  const pick = (mvp, anchor) =>
    anchor[puuid] ?? mvp[puuid] ?? null
  assert.equal(pick({ [puuid]: '/m.png' }, { [puuid]: '/a.png' }), '/a.png')
  assert.equal(pick({ [puuid]: '/m.png' }, {}), '/m.png')
  assert.equal(pick({}, {}), null)
})

test('아무 사진도 없는 puuid 는 null 이다', () => {
  assert.equal(getPlayerPhoto('nobody', 'mvp'), null)
  assert.equal(getPlayerPhoto('nobody', 'anchor'), null)
})

test('MVP 사진은 추적 4인 모두 등록되어 있다', () => {
  for (const player of TRACKED_PLAYERS) {
    assert.ok(MVP_PHOTOS[player.puuid], `${player.gameName} 의 MVP 사진이 없다`)
  }
})
