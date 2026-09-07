import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { roleFromTags } from '../src/lib/scoring.ts'
for (const line of readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n')) {
  const m = line.trim().match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const version = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0]
const cdata = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)).json()).data
const roles = {}
for (const c of Object.values(cdata)) roles[c.id] = roleFromTags(c.tags)

const N = Number(process.argv[2] ?? 30)
const { data: games } = await sb.from('games')
  .select(`id, played_at, game_results ( champion_name, kills, deaths, assists, perf_score, players(puuid, game_name) )`)
  .order('played_at', { ascending: false }).limit(N)

const rows = games.flatMap(g => g.game_results.filter(r=>r.players)
  .map(r => ({ gid:g.id, role: roles[r.champion_name] ?? 'fighter', champ:r.champion_name,
               name:r.players.game_name, score:r.perf_score, k:r.kills,d:r.deaths,a:r.assists })))
const avg=(xs,f)=>xs.length?xs.reduce((x,y)=>x+f(y),0)/xs.length:0
const overall = avg(rows,r=>r.score)
const m=new Map(); for(const r of rows){if(!m.has(r.role))m.set(r.role,[]);m.get(r.role).push(r)}
console.log(`저장된 점수 기준 · 최근 ${games.length}경기 / ${rows.length}건 / 전체평균 ${overall.toFixed(1)}\n`)
console.log('role        n   평균   편차')
for (const [role,rs] of [...m].sort((a,b)=>avg(b[1],r=>r.score)-avg(a[1],r=>r.score))) {
  const d = avg(rs,r=>r.score)-overall
  console.log(`${role.padEnd(9)} ${String(rs.length).padStart(3)}  ${avg(rs,r=>r.score).toFixed(1).padStart(5)}  ${(d>=0?'+':'')+d.toFixed(1)}`)
}
const mvp=new Map()
for (const g of games) { const rs=rows.filter(r=>r.gid===g.id); if(!rs.length)continue
  const t=rs.reduce((x,y)=>y.score>x.score?y:x); mvp.set(t.role,(mvp.get(t.role)??0)+1) }
console.log('\nMVP 분포:', [...mvp].sort((a,b)=>b[1]-a[1]).map(([r,n])=>`${r} ${n}`).join(', '))
console.log(`최고 ${Math.max(...rows.map(r=>r.score))} / 최저 ${Math.min(...rows.map(r=>r.score))}`)
console.log('\n상위 8:')
for (const r of [...rows].sort((a,b)=>b.score-a.score).slice(0,8))
  console.log(`  ${String(r.score).padStart(5)} ${r.role.padEnd(9)} ${r.champ.padEnd(13)} ${r.name.padEnd(14)} ${r.k}/${r.d}/${r.a}`)
