import assert from 'node:assert/strict'
import test from 'node:test'

import { roleFromTags } from '../src/lib/scoring.ts'

test('첫 태그가 대표 역할이 된다', () => {
  assert.equal(roleFromTags(['Marksman', 'Mage']), 'carry')       // 스몰더·진
  assert.equal(roleFromTags(['Mage', 'Assassin']), 'mage')        // 아리
  assert.equal(roleFromTags(['Fighter', 'Tank']), 'fighter')      // 다리우스
})

test('Support 를 먼저 단 인챈터는 서포터로 잡는다', () => {
  // 예전 우선순위표에서는 Support 가 맨 뒤라 전부 mage 로 샜다.
  assert.equal(roleFromTags(['Support', 'Mage']), 'support')      // 야나·소라카·밀리오·나미·질리언
})

test('딜을 앞세운 메이지는 Support 태그가 있어도 마법사로 남는다', () => {
  assert.equal(roleFromTags(['Mage', 'Support']), 'mage')         // 럭스·모르가나·자이라
})

test('Support 와 Tank 를 함께 단 챔피언은 앞라인으로 본다', () => {
  assert.equal(roleFromTags(['Support', 'Tank']), 'tank')         // 탐 켄치·브라움
  assert.equal(roleFromTags(['Tank', 'Support']), 'tank')         // 레오나·알리스타
})

test('탱커 태그를 먼저 단 챔피언은 마법사·전사로 새지 않는다', () => {
  assert.equal(roleFromTags(['Tank', 'Mage']), 'tank')            // 초가스·갈리오
  assert.equal(roleFromTags(['Tank', 'Fighter']), 'tank')         // 사이온·문도·포피
})

test('태그가 없으면 기본 역할로 떨어진다', () => {
  assert.equal(roleFromTags(undefined), 'fighter')
  assert.equal(roleFromTags([]), 'fighter')
  assert.equal(roleFromTags(['Unknown']), 'fighter')
})
