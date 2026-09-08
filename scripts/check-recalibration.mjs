/**
 * 역할 보정계수(ROLE_CALIBRATION)를 다시 맞출 때가 됐는지 알려준다.
 *
 * 점수 축 중 셋은 "그 이후 경기에만 있는" 데이터다 — 과거를 백필할 방법이
 * 없어서(README 의 백필 절 참고) 새 기준 경기가 쌓이기를 기다려야 한다.
 * 지금 보정계수는 그 지표가 거의 없던 표본에서 뽑은 값이라, 데이터가 충분히
 * 모이면 그 구간만으로 다시 맞춰야 눈금이 맞는다.
 *
 * 언제였는지 기억에 맡기지 않으려고 만든 스크립트다.
 *
 *   node scripts/check-recalibration.mjs
 *
 * 준비가 됐으면 그 구간만으로 계수를 새로 뽑아 함께 출력한다. 출력값을
 * scoring.ts 에 옮겨 적고 `node scripts/recalc-scores.mjs --apply` 를 돌리면
 * 반영된다.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { calculateFairScores, roleFromTags, resolveRole } from '../src/lib/scoring.ts'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.trim().match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim()
}

/** 이 수만큼 쌓이면 그 구간만으로 계수를 다시 맞출 만하다. */
const READY_THRESHOLD = 60

/** 새 기준인지 판별하는 컬럼들. 하나라도 차 있으면 그 경기는 새 기준이다. */
const NEW_BASIS_COLUMNS = [
  ['damage_self_mitigated', '막아낸 피해 (탱킹 축)'],
  ['heals_on_teammates', '팀원 힐 (자힐 제외)'],
  ['shields_on_teammates', '팀원 실드 (보호 축)'],
  ['hard_cc_count', '하드CC 횟수 (CC 축)'],
]

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const version = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]
const cdata = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)).json()).data
const roles = {}
for (const c of Object.values(cdata)) roles[c.id] = roleFromTags(c.tags)

const { data: games, error } = await sb.from('games')
  .select(`id, played_at, duration_seconds,
    game_results ( champion_name, kills, deaths, assists, damage_dealt, damage_taken,
      healing, heals_on_teammates, shields_on_teammates, damage_self_mitigated,
      hard_cc_count, cc_score, players(puuid) )`)
  .order('played_at', { ascending: false }).limit(2000)
if (error) { console.error(error); process.exit(1) }

// ── 축별로 얼마나 찼는지 ────────────────────────────────────────────────────
console.log(`저장된 경기 ${games.length}건\n`)
console.log('축                        경기수   진행')
const covered = {}
for (const [column, label] of NEW_BASIS_COLUMNS) {
  const n = games.filter(g => g.game_results.some(r => r[column] !== null)).length
  covered[column] = n
  const bar = '█'.repeat(Math.min(20, Math.round(n / READY_THRESHOLD * 20))).padEnd(20, '·')
  console.log(`${label.padEnd(24)} ${String(n).padStart(4)}   ${bar} ${n}/${READY_THRESHOLD}`)
}

// 탱킹 축이 가장 먼저 차는 축이다 (LCU 가 유일하게 주는 새 지표).
const leading = covered.damage_self_mitigated
const ready = leading >= READY_THRESHOLD

console.log()
if (!ready) {
  console.log(`아직 이르다. 막아낸 피해가 실린 경기 ${leading}건 — ${READY_THRESHOLD - leading}건 더 필요하다.`)
  console.log('실드·하드CC 는 프로덕션 API 키 없이는 영영 차지 않는다 (README 참고).')
  process.exit(0)
}

// ── 준비됐으면 그 구간만으로 계수를 새로 뽑는다 ────────────────────────────
console.log(`준비됐다. 막아낸 피해가 실린 ${leading}경기로 계수를 다시 뽑는다.\n`)

const sample = games.filter(g => g.game_results.some(r => r.damage_self_mitigated !== null))
const rows = []
for (const g of sample) {
  const participants = g.game_results.map(r => ({
    puuid: r.players.puuid,
    championName: r.champion_name,
    win: false, // 승리 가산점은 역할과 무관해 계수에 영향을 주지 않는다
    kills: r.kills, deaths: r.deaths, assists: r.assists,
    totalDamageDealtToChampions: r.damage_dealt,
    totalDamageTaken: r.damage_taken,
    totalHeal: r.healing,
    totalHealsOnTeammates: r.heals_on_teammates ?? undefined,
    totalShieldsOnTeammates: r.shields_on_teammates ?? undefined,
    damageSelfMitigated: r.damage_self_mitigated ?? undefined,
    hardCcCount: r.hard_cc_count ?? undefined,
    totalTimeCCDealt: r.cc_score,
  }))
  const scores = calculateFairScores(participants, {
    durationSeconds: g.duration_seconds, roles,
  })
  for (const p of participants) {
    rows.push({ role: resolveRole(p.championName, roles), score: scores.get(p.puuid) })
  }
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length
const overall = mean(rows.map(r => r.score))
const byRole = {}
for (const r of rows) (byRole[r.role] ??= []).push(r.score)

console.log('역할        n     평균    전체대비   현재계수에 곱할 값')
const factors = {}
for (const [role, scores] of Object.entries(byRole).sort((a, b) => b[1].length - a[1].length)) {
  const m = mean(scores)
  // 평균이 전체보다 높으면 그만큼 계수를 키워 눌러 준다.
  const factor = m / overall
  factors[role] = factor
  console.log(`${role.padEnd(10)} ${String(scores.length).padStart(4)}  ${m.toFixed(1).padStart(5)}  ${(m - overall >= 0 ? '+' : '')}${(m - overall).toFixed(1).padStart(5)}      ×${factor.toFixed(3)}`)
}

console.log('\nscoring.ts 의 ROLE_CALIBRATION 각 값에 위 배수를 곱하고,')
console.log('편차가 ±0.1 안에 들 때까지 이 스크립트를 반복해서 돌린다.')
console.log('맞춘 뒤에는 반드시: node scripts/recalc-scores.mjs --apply')
