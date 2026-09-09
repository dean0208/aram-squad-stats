# ARAM Squad Stats

칼바람 나락(ARAM Mayhem) 4인 스쿼드 전적 대시보드.

## 프로젝트 구조

| 경로 | 설명 |
| --- | --- |
| `src/app` | Next.js App Router 페이지 및 API 라우트 |
| `src/lib` | 점수 계산, 인사이트, Riot/LCU 매핑 등 도메인 로직 |
| `src/components` | 대시보드 UI 컴포넌트 (`MvpCelebration.tsx` = MVP 축하 모달) |
| `tests` | `node --test` 기반 순수 로직 테스트 |
| `supabase/migrations` | DB 스키마 정본. 파일명 날짜 순서대로 적용하면 현재 상태가 된다 |
| `docs` | 현황 감사 문서, 통계 용어 사전 |
| `public/players` | 하루의 상 연출에 띄우는 플레이어 사진. MVP 용은 바로 아래, 걸배이 용은 `anchor/` 하위에 (`src/lib/config.ts` 의 `MVP_PHOTOS` · `ANCHOR_PHOTOS` 참고) |
| `lcu-agent` | 롤 클라이언트에서 전적을 수집해 서버로 보내는 Windows 로컬 에이전트 — [설치·실행 가이드](lcu-agent/README.md) |

## 데이터 조회 레이어

경기 조회는 전부 `src/lib/games.ts` 한 곳을 거칩니다.

| 함수 | 용도 |
| --- | --- |
| `fetchGames(limit)` | 최신순 경기 목록. 중첩 플레이어는 `puuid`/`game_name`만 선택. `GAMES_CACHE_TAG`로 캐시 |
| `fetchPlayers()` | 추적 4인 행을 설정 순서대로. `GAMES_CACHE_TAG`로 캐시 |
| `fetchGameById(id)` | 경기 상세. `tag_line`까지 포함한 전체 컬럼 |
| `getCachedNicknames()` | 스쿼드 마일스톤. `GAMES_CACHE_TAG`로 캐시 |

LCU 수집 성공 시 `/api/lcu-sync`가 `revalidateTag(GAMES_CACHE_TAG, { expire: 0 })`을 호출합니다.
대시보드의 기록 새로고침도 같은 캐시를 즉시 갱신합니다.

## API 엔드포인트

| 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /api/games?limit=` | 없음 | 경기 목록 (limit 최대 500) |
| `GET /api/games/[id]` | 없음 | 경기 상세 |
| `GET /api/players/badges?limit=` | 없음 | 마일스톤 수상 목록 |
| `GET /api/players/[puuid]/report` | 없음 | 플레이어 챔피언 리포트 |
| `GET /api/last-sync` | 없음 | 마지막 저장 경기 시점 (에이전트가 사용) |
| `GET /api/sync` | 없음 | 사용 중단 안내 (410), Riot 호출 없음 |
| `POST /api/lcu-sync` | body `secret` | 로컬 에이전트 전송 수신 |
| `POST /api/recalculate-scores` | `x-lcu-sync-secret` 헤더 | 저장된 점수 전체 재계산 |
| `GET /api/debug` | `x-lcu-sync-secret` 헤더 | Riot API 연결 진단 |

## 점수 모델

`src/lib/scoring.ts` 가 경기당 0-100 점수를 낸다. 세 축을 합친다.

| 축 | 내용 | 비중 |
| --- | --- | --- |
| 개인 지분 | 팀 내 킬관여·딜·피해흡수·힐·CC 지분, 역할별 가중치 | 80% |
| 팀 절대 성과 | 팀 분당 딜과 팀 KDA가 통상 수준 대비 어떤가 | 20% |
| 데스 지분 | 제 몫보다 많이 죽으면 감점 | 최대 -18점 |

승리 시 +5점. 누적 표본에서 평균 약 61점, 하위 10% 약 46점, 상위 10% 약 76점.

### 역할 중립성

역할별 가중치만으로는 균형이 맞지 않았다. 실측에서 탱커 평균이 전체보다 8점 높고
마법사·암살자가 3~4점 낮았다 — 점수가 플레이가 아니라 챔피언 선택을 반영하던 것.
그래서 `ROLE_CALIBRATION` 으로 역할별 통상 지분 수준을 나눠 눈금을 맞춘다.

보정 후 각 역할이 "제 역할대로 평균만큼" 했을 때 점수 격차는 2.5점이다
(보정 전 12.3점). `tests/roleNeutrality.test.mjs` 가 이 성질을 지킨다.

남은 편차는 데스뿐이다. 점수 구성을 분해하면:

| 역할 | 지분항 | 팀성과항 | 데스항 | 합계 |
| --- | --- | --- | --- | --- |
| 원딜 | 46.7 | 12.4 | −0.8 | 60.9 |
| 마법사 | 44.9 | 12.4 | **+1.1** | 61.1 |
| 암살자 | 45.1 | 12.7 | **−2.6** | 57.8 |
| 브루저 | 46.4 | 12.0 | −1.1 | 59.7 |
| 탱커 | 46.4 | 11.6 | **−0.4** | 59.9 |

지분항은 역할 간 1.8점 이내로 모인다. 암살자가 낮은 건 실제로 더 죽기 때문이고
(데스 지분 28.6% vs 제 몫 25%), 탱커는 −0.4점으로 사실상 손해가 없다.
칼바람에서는 역할과 무관하게 데스 지분이 23~29% 로 비슷하다.

**보정계수는 누적 221경기에 반복 대입해 여섯 역할의 평균이 전체 평균과
±0.1점 안에서 만나도록 맞춘 값이다** (역할별 표본 31~270건). 픽 성향이 바뀌면
다시 계산해야 한다 — 역할별 점수 평균 / 전체 평균의 비를 계수에 곱해 몇 번
반복하면 수렴한다.

### 그 외 주의할 점

- **역할 판정은 DDragon 태그의 첫 번째 값**을 쓴다 (`roleFromTags`, `src/lib/scoring.ts`). 하드코딩 목록만 쓰던 시절에는 실제 픽의 32%만 판정됐고, 그 뒤 고정 우선순위표(Marksman → … → Support)를 쓰던 시절에는 Support 가 맨 뒤라 **야나·소라카·밀리오·나미·질리언이 전부 mage 로 샜다** — 최근 30경기에서 서포터로 잡힌 픽이 0건, 등장 챔피언 67종 중 21종이 틀린 역할을 받고 있었다. 예외는 하나로, Support 와 Tank 를 함께 단 챔피언(탐 켄치·브라움)은 앞라인으로 본다.
- **한 축의 지분은 제 몫의 2배에서 끊는다** (`AXIS_SHARE_CAP`). 힐처럼 한 명이 팀 합계의 70%를 가져갈 수 있는 축은 위로 열려 있어서, 서포터 가중치와 곱해지면 다른 축을 전부 덮어썼다 (보정 전 소라카 99.2점).
- **힐은 팀원에게 준 것만 센다.** `healing`(Riot `totalHeal`)에는 물약·흡혈·자힐이 섞여 있어, 탐 켄치 65k·오른 43k 같은 순수 자힐이 팀 힐 합계를 부풀리고 실제로 팀을 살린 서포터의 지분을 희석했다. 그래서 팀원에게 준 힐만 담는 `heals_on_teammates` 를 따로 두고 `healingForScore()` 가 그것을 우선 쓴다. `NULL` 인 옛 경기는 예전처럼 `healing` 으로 폴백한다 — `healing` 의 뜻을 조용히 바꾸면 옛 행과 새 행을 구분할 수 없게 된다. **과거 경기는 원본이 없어 백필이 불가능하다.**
- **축은 챔피언 킷이 아니라 플레이를 재야 한다.** 221경기 분석에서 역할 *사이* 편차는 ±0.1 로 잡혔지만 역할 *안* 편차가 25점(전체 sd 12.0 의 2배)이었다. 원인은 축이 재는 대상이 킷에 따라 통째로 빠지는 것이었고, 셋을 고쳤다.
  - **보호 = 힐 + 실드.** 힐만 세던 시절에는 룰루·레나타·세라핀처럼 킷이 실드인 서포터가 0 으로 잡혔다 (룰루 44.2 vs 밀리오 69.2, 힐 지분이 점수를 그대로 따라갔다). 둘 다 HP 단위라 더해서 한 축으로 쓴다.
  - **CC = 지속시간 + 묶은 횟수.** `cc_score` 는 지속시간이라 마오카이·오른 같은 긴 소프트 CC 가 말파이트·블리츠크랭크 같은 순간 하드 CC 를 이겼다. 궁 한 방으로 한타를 여는 플레이가 점수는 더 낮았다.
  - **탱킹 = 받은 피해 + 막아낸 피해.** 받은 피해만 쓰면 탱커 점수가 "얼마나 맞았나" 하나로 정해져(말파이트 흡수 21%→44.5, 오른 46%→73.5), 어그로를 끌어서 맞은 것과 그냥 던진 것이 구분되지 않았다.
  - 단위가 다른 두 신호(초 vs 횟수)는 원값을 더할 수 없어 각각 지분으로 만든 뒤 평균한다(`blended`). 한쪽이 없는 구간에서는 남은 쪽만 쓴다.
- **챔피언별 보정계수는 만들지 않는다.** 표본이 챔피언당 8~22건이라 과적합이다. 역할 안 편차는 축을 고쳐서 줄인다.
- **CC 가 쌓이면 보정계수를 다시 계산해야 한다.** `cc_score` 는 2026-09-06 부터만 실려 있다 (221경기 중 10경기). CC 는 탱커·서포터에서 가중치가 30 으로 가장 큰 축인데, 지금 보정계수는 CC 가 거의 없는 표본에서 뽑은 값이다. CC 가 실린 경기가 60판쯤 쌓이면 그 구간만으로 다시 맞춰야 눈금이 맞는다. 과거 경기는 원본이 없어 백필이 불가능하다. **자힐 제외(`heals_on_teammates`, 2026-09-08 부터)도 같은 이유로 재보정 방아쇠다.** 두 방아쇠가 같은 구간을 가리키므로 한 번에 묶어서 맞추면 된다.
- **팀 합계가 0인 지표는 정규화 분모에서도 뺀다.** 어떤 지표가 수집되지 않는 구간이 생겨도 점수 눈금이 흔들리지 않는다. CC는 실제로 오래 0으로 저장되어 있었다.
- **절대 성과는 팀 단위로만 잰다.** 개인 딜량을 쓰면 탱커·서포터가 역할 때문에 구조적으로 손해를 본다.
- 저장되는 `game_results` 에는 추적 4인만 남으므로, 수집과 재계산이 **모두 4인 기준**으로 계산한다. 한쪽만 10인 기준으로 두면 같은 경기의 점수가 재현되지 않는다.

`toDisplayContributionScore` 는 반올림만 한다. 모델이 이미 100점 기준이다.

> **상수를 바꾸면 반드시 재계산해야 한다.** 아래 참고.

## 과거 경기 백필은 불가능하다 — 이 모드는 Match-V5 에 없다

`shields_on_teammates` · `hard_cc_count` · `damage_self_mitigated` ·
`totalHealsOnTeammates` 는 전부 Riot Match-V5 응답에 있는 필드다. 그래서
`match_id` 로 다시 읽어 과거 221경기를 채울 수 있을 것처럼 보인다.

**되지 않는다. Match-V5 가 ARAM Mayhem(큐 2400)을 아예 싣지 않는다.**

```
ids(큐 필터 없음)   → 200, 최신이 2026-07-12 (큐 480 경기)
ids(queue=2400)   → 200, 0건          ← 권한 문제면 여기서 403 이 났어야 한다
매치 상세 (큐 480)  → 200
매치 상세 (큐 2400) → 403             ← 저장된 221경기가 전부 여기
```

`ids?queue=2400` 이 **200 인데 0건**인 것이 핵심이다. 정상 응답하면서 "그런
경기 없다" 고 답한다 — 인덱스에 큐 2400 이 없다는 뜻이다. 상세 조회가 404 가
아니라 403 으로 오는 건 이상하지만, 큐 필터 결과와 합쳐 보면 결론은 하나다.

라우팅 문제가 아니고 (`sea` 가 맞고 나머지 셋은 404), 레이트리밋도 아니며
(100:120 중 2건 사용), 키도 살아 있다 (큐 480 경기는 200).

**이것이 애초에 LCU 에이전트가 존재하는 이유다.** 커밋 순서가 그대로 남아
있다 — `58ec5e1 Mayhem 지원` → `d14f17a debug 엔드포인트` →
`a53858c LCU agent`. 한 번 겪고 우회한 문제이므로, 같은 길을 다시 파지 말 것.
**프로덕션 API 키를 받아도 열리지 않는다.** 키 등급 문제가 아니다.

### LCU 가 주는 것과 주지 않는 것 (실측)

LCU 의 match-history 는 **구 match-v4 포맷**이라 `challenges` 블록이 없다.

| 지표 | LCU | 비고 |
|---|---|---|
| 막아낸 피해 | **O** | `damageSelfMitigated` |
| CC 지속시간 | **O** | `totalTimeCrowdControlDealt` |
| 팀원 힐 | **X** | `totalHeal`(자힐 포함)과 `totalUnitsHealed`(명수)만 있다 |
| 팀원 실드 | **X** | 어떤 키로도 없다 |
| 하드CC 횟수 | **X** | `challenges` 가 없다 |

클라이언트가 들고 있는 Mayhem 경기도 9건(2026-09-05 까지)이라 백필할 과거가
애초에 없다.

### 결론

- **탱킹 축은 살아난다.** 막아낸 피해가 에이전트를 통해 들어온다.
- **보호 축의 자힐 분리, 실드, 하드CC 는 이 게임 모드에서 측정 불가다.**
  기다린다고 열리는 것이 아니다. `healingForScore()` 는 계속 `totalHeal`
  (자힐 포함) 로 폴백하며, 그 사실을 알고 쓰는 것이 근사값을 지어내는 것보다
  낫다 — `totalUnitsHealed`(명수)를 HP 축에 섞으면 단위가 다른 것을 섞는
  것이라, CC 축에서 지적한 것과 같은 실수가 된다.
- 코드는 값이 오면 바로 쓰도록 되어 있고, 없는 동안에는 남은 신호만으로 돌아
  점수가 흔들리지 않는다 (`blended`). 라이엇이 나중에 싣기 시작하면 그때
  자동으로 켜진다.

### 재보정 시점은 스크립트가 알려준다

새 기준 경기가 얼마나 쌓였는지 기억에 맡기지 않는다.

```bash
node scripts/check-recalibration.mjs
```

축별로 몇 경기가 찼는지 보여 주고, 60경기를 넘기면 그 구간만으로 계수를 새로
뽑아 출력한다. 출력값을 `scoring.ts` 의 `ROLE_CALIBRATION` 에 곱해 넣고 편차가
±0.1 안에 들 때까지 반복한 뒤, `node scripts/recalc-scores.mjs --apply` 로
저장값을 갱신한다.

## 저장 점수 재계산

점수 모델 상수를 바꾼 뒤, 또는 이름이 안 풀린 챔피언을 복구하려면:

```bash
curl -X POST https://aram-squad-stats.vercel.app/api/recalculate-scores \
  -H "x-lcu-sync-secret: <REPLACE_WITH_SECRET_MANAGER>"
```

응답의 `updated` 는 갱신된 결과 수, `renamed` 는 이름을 복구한 챔피언 수다.
실행 후 캐시는 자동으로 무효화된다.

시크릿 없이 로컬에서 돌릴 때는 같은 일을 하는 스크립트를 쓴다. 이전 점수는
`perf-score-backup.json` 에 남는다.

```bash
node scripts/recalc-scores.mjs            # 미리보기 (쓰지 않는다)
node scripts/recalc-scores.mjs --apply    # 실제 반영
```

## 점수 컬럼

저장되는 점수는 `game_results.perf_score` **하나뿐이다.**

예전에는 `contribution_score` 가 함께 있었지만, `calcContributionScore()` 가
계산된 perf 를 그대로 돌려주고 있어서 두 컬럼의 값이 항상 같았다. payload 와
화면 라벨만 두 배가 되어 `perf_score` 로 통합했다
(`supabase/migrations/20260907_single_score_and_teammate_healing.sql`, 2026-09-08 적용).

화면 표기는 `src/lib/displayScore.ts` 의 `toDisplayScore()` 가 담당하고,
지금은 0-100 로 자르고 반올림만 한다.

## 하루의 상 연출 (MVP · 걸배이)

선택한 날짜가 **가장 최근 날짜일 때** 그 날의 MVP 나 걸배이가 바뀌면, 해당
플레이어의 사진을 크게 띄우는 모달이 2초간 뜬다
(`src/components/MvpCelebration.tsx`).

- **둘 다 바뀌면 화면을 위아래로 정확히 반씩** 나눠 스크롤 없이 한 화면에 담고,
  하나만 바뀌면 그쪽이 화면 전체를 쓴다. 위 칸은 꽃가루가 쏟아지는 축하,
  아래 칸은 파리가 맴도는 반대 연출이다.
- 띄울지 말지는 `src/lib/mvpCelebration.ts` 의 `resolveCelebrationPlan()` 이
  정한다. 순수 함수라 테스트가 있다.
- 이미 보여 준 대상은 `localStorage` 의 `aram:last-mvp-celebration` /
  `aram:last-anchor-celebration` 으로 기억해 다시 띄우지 않는다. 지난 날짜를
  넘겨볼 때는 아예 뜨지 않는다.
- 걸배이 판정은 `src/lib/dailyTrend.ts` 가 맡는다. 화면 하단 카드와 연출이 같은
  사람을 가리켜야 해서 한 곳에 뒀다.
- **사진은 상마다 따로 등록한다.** MVP 용은 `public/players/` 에 넣고
  `MVP_PHOTOS`(`src/lib/config.ts`)에, 걸배이 용은 `public/players/anchor/` 에
  넣고 `ANCHOR_PHOTOS` 에 적는다. 얼굴이 가운데 오는 정사각형 이미지가 원형
  마스크에 잘 맞는다.
  - `ANCHOR_PHOTOS` 에 없는 사람은 **MVP 사진으로 돌아간다.** 표를 비워 두거나
    일부만 채워도 화면이 깨지지 않으므로, 사진을 받는 대로 한 줄씩 더하면 된다.
  - 양쪽 다 없으면 **이름 첫 글자를 대신 세운다.**
- 모달은 `createPortal` 로 `body` 에 직접 붙인다. 대시보드 안에 두면 조상의
  stacking context 에 갇혀, `z-50` 인데도 `z-40` 짜리 하단탭이 위로 올라왔다.
- **동작 줄이기(`prefers-reduced-motion`)를 켠 화면에서는 움직임만 뺀다.**
  예전에는 꽃가루와 파리를 `display: none` 으로 통째로 지웠는데, 그러면 축하도
  놀림도 사라져 두 칸이 똑같이 밋밋해졌다. 지금은 흩뿌린 자리에 멈춰 세운다.
  (떨어지는 꽃가루는 전부 `top: 0` 에 겹치므로 개체마다 `--confetti-top` 을 준다.)

## 메달과 마일스톤

- **메달**(`src/lib/medals.ts`)은 나머지 참가자 평균 대비 배수 기준을 넘어야 발급된다. 스탯별 자연 분산이 달라 기준을 따로 잡았고(골드 1.1배, 힐량 3배), 누적 표본에서 발급률이 대략 절반이 되는 지점이다. MVP만 항상 발급한다.
- **마일스톤**(`src/lib/nicknames.ts`)은 2위와의 격차를 함께 보여준다. 4명이 항상 같은 수를 뛰어 누적 총량이 잘 수렴하고, 실측에서 어시스트 1위 격차는 1.1% 였다. 5% 미만이면 "접전"으로 표시한다.

## 아이템 데이터

`game_results.item_ids` 는 두 수집 경로 모두 저장한다. **다만 점수에는 아직
반영하지 않는다** — 빌드를 점수에 넣는 방법을 정하지 못해 미뤄 둔 상태다.

그래도 저장은 지금부터 해 둔다. `cc_score` 가 한동안 0으로 저장되다가 원본이
없어 백필이 불가능해진 전례가 있다. 나중에 빌드 분석을 붙일 때 과거 경기까지
쓰려면 수집 시점에 남겨 두는 수밖에 없다.

## 전적 동기화

새 경기는 Windows의 `lcu-agent/실행.bat`으로 수집한다.
에이전트가 롤 클라이언트(LCU)에서 읽은 경기를 `POST /api/lcu-sync`로 전송한다.
`LCU_SYNC_SECRET`은 Windows OS 환경변수와 Vercel에 같은 값을 설정한다.

대시보드의 "기록 새로고침" 버튼은 저장된 Supabase 기록만 다시 읽는다.
Riot Match-V5 수집과 매시간 GitHub Actions 워크플로는 사용하지 않으며,
`GET /api/sync`는 410을 반환한다. `RIOT_API_KEY`와 `SYNC_SECRET`은 필요하지 않다.

에이전트 설치와 오류 대응은 [`lcu-agent/README.md`](lcu-agent/README.md) 참고.

## 배포

**`git push` 만으로는 배포되지 않는다.** Vercel 프로젝트가 Git 연동되어 있으면
푸시로 배포되고, 아니면 Mac 에서 아래를 실행해야 한다.

```bash
npx vercel --prod
```

배포 후 점수 모델 상수를 바꿨다면 재계산도 함께 실행한다.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
