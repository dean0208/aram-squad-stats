# Current State Audit

작성 기준: existing codebase inspection before mobile redesign

## Stack and rendering

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4.
- Server-rendered pages read Supabase through `src/lib/supabase.ts`.
- The dashboard is a client component at `src/components/DashboardClient.tsx`.
- Static metadata is fetched from Data Dragon in `src/lib/championNames.ts` and `src/app/page.tsx`.
- Production build: `npm run build`; tests: `npm test`; lint: `npm run lint`.

## Routes

- `/`: dashboard and date-filtered daily view.
- `/games/[id]`: existing game detail route.
- `/players/[puuid]`: existing player detail route; preserve this URL.
- `/api/games`, `/api/games/[id]`, `/api/players/[puuid]/report`, `/api/players/badges`: read APIs.
- `/api/sync`, `/api/lcu-sync`, `/api/last-sync`: existing sync/status endpoints. Redesign must not change their contracts.

## Data boundary

- Stored game model is `Game` in `src/lib/types.ts`.
- Stored result fields: champion, K/D/A, damage dealt/taken, healing, ally healing (`heals_on_teammates`, from 2026-09-08, `NULL` before), gold, CC score, performance score, augment IDs, item IDs.
- `perf_score` is the only stored score. `contribution_score` always held the identical value and was dropped.
- Stored `games` fields include `played_at`, duration, team result, and IDs.
- There is no reliable stored source-updated timestamp per game result. `/api/last-sync` currently reports latest `played_at`, which is not the same as source receive time.
- All game reads go through `src/lib/games.ts`. List queries select only the two nested player columns they read; detail queries select the full row.
- LCU/Riot ingestion code exists in `src/lib/riot.ts`, `src/app/api/lcu-sync/route.ts`, and `lcu-agent/lcu_agent.py`. These are out of scope for this redesign.

## Existing calculations

- `src/lib/scoring.ts`: 0-100 score combining tracked-player share (80%), team absolute output (20%), and a death-share penalty. Roles come from DDragon tags via `src/lib/championRoles.ts`; the hardcoded list is a fallback only. Metrics with a zero team total are excluded from the normalizing denominator.
- `src/lib/displayScore.ts`: `toDisplayScore()` clamps to 0-100 and rounds. The model already outputs 0-100, so the old `sqrt(raw / 50)` stretch is gone.
- `src/lib/mvp.ts`: selects the highest performance score.
- `src/lib/medals.ts` and `src/lib/nicknames.ts`: milestone/medal aggregation, skip all-zero and tied nickname winners.
- `src/lib/playerInsights.ts`: deterministic recent-five advice from team-relative damage/deaths and role.
- `src/lib/teamInsights.ts`: composition observations, exact composition stats, best/worst role stats. Exact composition requires at least 3 games; role stats require at least 10 games.
- `src/lib/formTrend.ts`: legacy form delta helper; current UI now uses a recent contribution line chart instead of the delta.

## Metadata and fallbacks

- Champion IDs/names use Data Dragon; image URLs use the canonical champion ID.
- Augment names use a checked-in Korean CommunityDragon-derived map with 643 entries and `증강 #ID` fallback.
- Item IDs are now written by both ingestion paths (`riot.ts` and `/api/lcu-sync`). Nothing reads them yet; they are stored so that a future build analysis is not blocked by missing history, the way `cc_score` was.
- `cc_score` was stored as 0 for 99% of rows: the agent read Match-V5's `totalTimeCCDealt` while the LCU payload uses `totalTimeCrowdControlDealt`. The agent now reads either. Rows recorded before that fix stay 0 — CC cannot be backfilled from stored data.
- Champion names/roles resolve against the latest DDragon version (`src/lib/ddragon.ts`); `DDRAGON_VERSION` in config is a pin for image URLs and a fallback. Rows stored as `Champion<id>` under the old pinned version are repaired by `/api/recalculate-scores`.

## Current UI and mobile risks

- Dashboard order is: 날짜 탐색 → 오늘의 MVP → 플레이어 4인 → 당일 게임 → 전체 이력 카드.
- Dashboard uses a two-column mobile player grid and several dense cards.
- Daily games are expandable rows, but home does not yet cap the list at five.
- Player detail champion table is responsive and hides secondary columns on small screens, but no shared normalized view model exists.
- Existing pages contain old English labels in game detail and some data-state messaging.
- Bottom navigation exists (`MobileBottomNav`) and points at home-page sections; away from `/` it links back to `/#section`. Standalone `/matches`, `/players`, `/records`, `/data-status` pages still do not exist.
- The home page still ships every fetched game to the client component. The Supabase read is cached under `GAMES_CACHE_TAG`, but the serialized payload still grows with the game count.
- No automated browser/E2E dependency is installed; visual verification must use rendered HTML/CSS inspection unless a browser session is available.

## Scope decisions for this redesign

- Do not change Riot API, Match-V5, LCU, local agent, or transport payload code.
- Prefer pure web-side adapters and derived view models.
- Do not invent patch, source receive time, team kill totals, mitigated damage, ally healing/shielding, item data, or unknown metadata.
- Use explicit `데이터 없음`, `표본 부족`, or `일부 지표 누락` states.
- Preserve PUUID player URLs and existing API contracts.
