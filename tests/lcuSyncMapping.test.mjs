import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveTrackedParticipants } from '../src/lib/lcuSyncMapping.ts'

const tracked = [
  { gameName: 'Hoodville', puuid: 'riot-hood' },
  { gameName: 'Interest Rate', puuid: 'riot-interest' },
  { gameName: 'Nunu and Lulu', puuid: 'riot-nunu' },
  { gameName: 'just won lotto', puuid: 'riot-lotto' },
]

const participant = (gameName, puuid = `lcu-${gameName}`) => ({ gameName, puuid, teamId: 100 })

test('정확히 서로 다른 4명의 고정 Riot PUUID를 반환한다', () => {
  const result = resolveTrackedParticipants(
    [participant('Hoodville'), participant('Interest Rate'), participant('Nunu and Lulu'), participant('just won lotto')],
    tracked,
  )
  assert.deepEqual(result.map(p => p.puuid), ['riot-hood', 'riot-interest', 'riot-nunu', 'riot-lotto'])
})

test('4명이 아니거나 중복 이름이면 저장 후보를 거부한다', () => {
  assert.equal(resolveTrackedParticipants([participant('Hoodville'), participant('Interest Rate')], tracked), null)
  assert.equal(resolveTrackedParticipants([
    participant('Hoodville'), participant('Hoodville', 'other'), participant('Nunu and Lulu'), participant('just won lotto'),
  ], tracked), null)
})
