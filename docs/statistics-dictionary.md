# Statistics Dictionary

All displayed scores use a 0–100 scale unless stated otherwise. Missing values are not treated as zero for new derived statistics.

| 화면 명칭 | 원본 필드 | 계산식 / 의미 | 단위 | 결측치·제외 | 사용처 | 버전 |
|---|---|---|---|---|---|---|
| 기여도 | `contribution_score` | stored score converted by `sqrt(raw / 50) * 100`, capped | points 0–100 | missing result excluded | dashboard, player detail | display-v1 |
| 성능 지수 | `perf_score` | stored performance score; no new score semantics | stored points | missing shown as unavailable | legacy detail fields | stored-v1 |
| 킬 관여율 | kills, assists, team kills | `(kills + assists) / team kills`; team kills are not currently stored, so do not display as exact | percent | unavailable without team kill total | reserved | n/a |
| 승률 | `our_team_win` | wins / games | percent | game must have a known result | all summaries | v1 |
| 평균 KDA | kills, deaths, assists | `(kills + assists) / deaths`, with zero-death fallback | ratio | zero deaths uses kills + assists | player detail | v1 |
| 받은 피해 | `damage_taken` | stored raw damage taken | damage | null/missing unavailable | player detail | v1 |
| 감소시킨 피해 | — | not present in stored schema | damage | never inferred from received damage | hidden | n/a |
| 아군 회복 | — | not present; stored `healing` does not identify recipient | damage/health | do not label as ally healing | hidden | n/a |
| 아군 보호막 | — | not present in stored schema | shield | hidden | n/a |
| CC 지속시간 | `cc_score` | stored field; semantics require source confirmation | seconds/score unknown | label remains CC 기여 where unit is unknown | dashboard/detail | stored-v1 |
| 평균 딜량 | `damage_dealt` | sum / result count | raw damage | missing result excluded from new averages | player detail | v1 |
| 폼 그래프 | `contribution_score` | display conversion per recent result, chronological line | points 0–100 | player results only | player detail | display-v1 |
| exact 4인 조합 승률 | champion names, `our_team_win` | wins / repeated sorted champion signature; requires >=3 games | percent | `참고용`; not causal | dashboard | v1 |
| role team win rate | champion metadata tag, `our_team_win` | wins / games for player and role; requires >=10 games | percent | under 10 excluded | dashboard | v1 |
| sample badge | game count | 1–2 참고용, 3–4 낮음, 5–9 보통, 10–19 충분, 20+ 높음 | label | count required | planned lists | v1 |

## Important limitations

- `played_at` is the match time, not source receive time.
- Team kill totals, patch, mitigated damage, ally healing, ally shielding, and item IDs are not reliably available to the current web read model.
- `healing` must not be presented as ally healing.
- A score must not be recomputed from missing components as zero.
- Exact composition statistics describe repeated observations only; they do not prove causality.
