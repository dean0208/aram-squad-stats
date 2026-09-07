# Statistics Dictionary

All displayed scores use a 0–100 scale unless stated otherwise. Missing values are not treated as zero for new derived statistics.

| 화면 명칭 | 원본 필드 | 계산식 / 의미 | 단위 | 결측치·제외 | 사용처 | 버전 |
|---|---|---|---|---|---|---|
| 기여도 | `perf_score` | stored score, clamped to 0–100 and rounded by `toDisplayScore()` | points 0–100 | missing result excluded | dashboard, player detail, game detail | display-v2 |
| 킬 관여율 | kills, assists, team kills | `(kills + assists) / team kills`; team kills are not currently stored, so do not display as exact | percent | unavailable without team kill total | reserved | n/a |
| 승률 | `our_team_win` | wins / games | percent | game must have a known result | all summaries | v1 |
| 평균 KDA | kills, deaths, assists | `(kills + assists) / deaths`, with zero-death fallback | ratio | zero deaths uses kills + assists | player detail | v1 |
| 받은 피해 | `damage_taken` | stored raw damage taken | damage | null/missing unavailable | player detail | v1 |
| 감소시킨 피해 | — | not present in stored schema | damage | never inferred from received damage | hidden | n/a |
| 아군 회복 | — | not present; stored `healing` does not identify recipient | damage/health | do not label as ally healing | hidden | n/a |
| 아군 보호막 | — | not present in stored schema | shield | hidden | n/a |
| 아이템 | `item_ids` | stored completed item IDs; collected but **not used in any score yet** | item IDs | empty array before 2026-08-29 | none (reserved) | v1 |
| CC 지속시간 | `cc_score` | stored field; semantics require source confirmation | seconds/score unknown | label remains CC 기여 where unit is unknown | dashboard/detail | stored-v1 |
| 평균 딜량 | `damage_dealt` | sum / result count | raw damage | missing result excluded from new averages | player detail | v1 |
| 폼 그래프 | `perf_score` | display conversion per recent result, chronological line | points 0–100 | player results only | player detail | display-v1 |
| exact 4인 조합 승률 | champion names, `our_team_win` | wins / repeated sorted champion signature; requires >=3 games | percent | `참고용`; not causal | dashboard | v1 |
| role team win rate | champion metadata tag, `our_team_win` | wins / games for player and role; requires >=10 games | percent | under 10 excluded | dashboard | v1 |
| sample badge | game count | 1–2 참고용, 3–4 낮음, 5–9 보통, 10–19 충분, 20+ 높음 | label | count required | planned lists | v1 |

## Important limitations

- `played_at` is the match time, not source receive time.
- `perf_score` is the only stored score. `contribution_score` held the same value and was dropped in `supabase/migrations/20260907_single_score_and_teammate_healing.sql`.
- Team kill totals, patch, mitigated damage, ally healing, and ally shielding are not available to the current web read model.
- Item IDs are stored by both ingestion paths but are not part of any displayed statistic or score.
- `healing` must not be presented as ally healing. It is Riot `totalHeal` and includes potions, lifesteal, and self-heal.
- `heals_on_teammates` is ally healing only and exists from 2026-09-08 onward; it is `NULL` for earlier games and cannot be backfilled. Scoring falls back to `healing` when it is `NULL`.
- A score must not be recomputed from missing components as zero.
- Exact composition statistics describe repeated observations only; they do not prove causality.
