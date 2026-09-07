/**
 * 저장된 모든 경기의 perf_score 를 현재 점수 모델로 다시 계산한다.
 *
 * scoring.ts 의 상수나 역할 분류를 바꾼 뒤에는 반드시 한 번 돌려야 화면과
 * 저장값이 맞는다. 같은 일을 하는 /api/recalculate-scores 가 있지만 그쪽은
 * LCU_SYNC_SECRET 을 요구하므로, 로컬에서 손으로 돌릴 때 이 스크립트를 쓴다.
 *
 *   node scripts/recalc-scores.mjs            # 미리보기 (쓰지 않는다)
 *   node scripts/recalc-scores.mjs --apply    # 실제 반영
 *
 * 이전 값은 perf-score-backup.json 에 남는다. 원본 지표(킬·딜·힐…)는 건드리지
 * 않으므로, 코드를 되돌리고 다시 돌리면 언제든 예전 점수로 복원된다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { calculateFairScores } from '../src/lib/scoring.ts'
import { roleFromTags } from '../src/lib/scoring.ts'
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.trim().match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim()
}
const APPLY = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const version = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]
const cdata = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)).json()).data
const roles = {}
for (const c of Object.values(cdata)) roles[c.id] = roleFromTags(c.tags)

const { data: games, error } = await sb.from('games')
  .select(`id, played_at, duration_seconds, our_team_win,
    game_results ( id, champion_name, kills, deaths, assists, damage_dealt, damage_taken, healing, heals_on_teammates, shields_on_teammates, damage_self_mitigated, hard_cc_count, cc_score, perf_score, players(puuid) )`)
  .order('played_at', { ascending: false }).limit(2000)
if (error) { console.error(error); process.exit(1) }

const updates = []
for (const g of games) {
  const rs = g.game_results.filter(r => r.players)
  if (!rs.length) continue
  const parts = rs.map(r => ({
    puuid: r.players.puuid, championName: r.champion_name, win: g.our_team_win,
    kills: r.kills, deaths: r.deaths, assists: r.assists,
    totalDamageDealtToChampions: r.damage_dealt, totalDamageTaken: r.damage_taken,
    totalHeal: r.healing, totalHealsOnTeammates: r.heals_on_teammates ?? undefined,
    totalShieldsOnTeammates: r.shields_on_teammates ?? undefined,
    damageSelfMitigated: r.damage_self_mitigated ?? undefined,
    hardCcCount: r.hard_cc_count ?? undefined,
    totalTimeCCDealt: r.cc_score,
  }))
  const scores = calculateFairScores(parts, { durationSeconds: g.duration_seconds, roles })
  for (const r of rs) {
    const next = scores.get(r.players.puuid)
    if (next != null && next !== r.perf_score) updates.push({ id: r.id, before: r.perf_score, after: next })
  }
}

writeFileSync(new URL('../perf-score-backup.json', import.meta.url), JSON.stringify(updates.map(u=>({id:u.id, perf_score:u.before})), null, 2))
const diffs = updates.map(u => u.after - u.before)
const avg = a => a.reduce((x,y)=>x+y,0)/a.length
console.log(`경기 ${games.length}판 / 변경 대상 ${updates.length}건`)
console.log(`평균 변화 ${avg(diffs).toFixed(2)}점, 최대 +${Math.max(...diffs).toFixed(1)} / 최소 ${Math.min(...diffs).toFixed(1)}`)
console.log(`이전 점수 백업 → perf-score-backup.json`)

if (!APPLY) { console.log('\n(미적용. 실제 반영하려면 --apply)'); process.exit(0) }

let done = 0
for (let i = 0; i < updates.length; i += 100) {
  const chunk = updates.slice(i, i + 100)
  await Promise.all(chunk.map(u => sb.from('game_results').update({ perf_score: u.after }).eq('id', u.id)))
  done += chunk.length
  process.stdout.write(`\r적용 ${done}/${updates.length}`)
}
console.log('\n완료')
