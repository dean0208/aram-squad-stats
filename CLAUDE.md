@AGENTS.md

# ARAM Squad Stats

칼바람 나락(ARAM Mayhem, queueId 2400) 4인 스쿼드 전적 대시보드.
추적 대상은 `src/lib/config.ts` 의 고정 4명이고, **4인 전원이 참여한 경기만** 저장한다.

## 어디서 뭐가 도는가

| 위치 | 역할 |
| --- | --- |
| Mac / Windows | 개발. 어느 쪽에서 해도 된다 |
| Vercel | 웹앱과 API. `main` 에 푸시하면 **자동 배포**(약 15초) |
| Windows PC | **LCU 에이전트 전용.** 롤 클라이언트가 있어야 lockfile 을 읽고 `127.0.0.1` 의 LCU API 를 호출할 수 있다 |

에이전트는 이 리포 안(`lcu-agent/`)에서 바로 실행한다. 예전에는 폴더를 데스크톱에
복사해 썼는데, 코드를 고칠 때마다 파일을 옮겨야 해서 그만뒀다. `git pull` 로 갱신한다.

## 명령

```bash
npm run dev      # 개발 서버
npm test         # node --test, 순수 로직만 (58개)
npm run lint
npm run build
```

테스트는 `.mjs` 에서 `.ts` 를 직접 import 한다. **테스트 대상 모듈은 확장자 없는
상대 import 를 쓰면 안 된다** — Node 의 ESM 리졸버가 못 찾는다. 그래서 `scoring.ts`
는 의존성이 없고, 네트워크 조회는 `championRoles.ts` 로 분리되어 있다.

## 반드시 지킬 것

**점수 모델 상수를 바꾸면 저장된 점수를 재계산해야 한다.** 안 하면 화면에 옛 눈금이
그대로 보인다. 배포 후:

```bash
curl -X POST https://aram4.vercel.app/api/recalculate-scores \
  -H "x-lcu-sync-secret: <시크릿>"
```

**점수는 수집·재계산 양쪽 모두 추적 4인 기준으로 계산한다.** `game_results` 에는
4명만 저장되므로, 한쪽만 10인 기준으로 두면 같은 경기의 점수를 재현할 수 없다.

**저장 점수 컬럼은 `perf_score` 하나다.** 같은 값을 담고 있던
`contribution_score` 는 제거했다. 화면 표기는 `toDisplayScore()` 를 쓴다.

**수집 필터는 두 경로가 같아야 한다.** 큐 종류(`SUPPORTED_QUEUES`)와
`DATA_START_DATE` 검사가 `config.ts` 에 있고 Riot·LCU 경로가 모두 본다.
예전에는 `riot.ts` 안에만 있어서 LCU 로 들어온 경기는 큐와 무관하게 저장됐다.

**Match-V5 는 ARAM Mayhem(큐 2400)을 싣지 않는다.** `ids?queue=2400` 이 200 인데 0건이고 매치 상세는 403 이다. 키 등급 문제가 아니라서 **프로덕션 키를 받아도 안 열린다.** 이것이 LCU 에이전트가 존재하는 이유다 (커밋 58ec5e1 → d14f17a → a53858c). 같은 길을 다시 파지 말 것.

**따라서 과거 백필은 불가능하고, 팀원 힐(자힐 분리)·팀원 실드·하드CC 는 이 모드에서 영구히 측정 불가다.** LCU 는 구 match-v4 포맷이라 `challenges` 가 없고, `damageSelfMitigated` 와 CC 지속시간만 온다. 기존 매시간 Riot 동기화 워크플로는 2026-09-09 개인 계정 이관 중 제거했다. 현재 수집은 Windows LCU 에이전트만 사용한다.

**힐 축은 `healingForScore()` 를 거쳐야 한다.** `healing` 은 자힐이 섞인 Riot `totalHeal` 이고, 팀원에게 준 힐만 담긴 `heals_on_teammates` 가 있으면 그걸 쓴다. 옛 경기는 `NULL` 이라 `healing` 으로 폴백하며 백필은 불가능하다. 새 기준 경기가 60판쯤 쌓이면 `ROLE_CALIBRATION` 을 다시 맞춰야 한다 (CC 와 같은 방아쇠).

**팀 합계가 0인 지표는 정규화 분모에서도 뺀다.** 어떤 지표가 수집되지 않는 구간이
생겨도 점수 눈금이 흔들리지 않게 하려는 것이다. CC 가 실제로 오래 0이었다.

**역할 보정(`ROLE_CALIBRATION`)을 지운 채로 가중치만 만지지 말 것.** 보정이 없으면
탱커가 전체 평균 +8점, 마법사·암살자가 −3~4점이 된다. 점수가 플레이가 아니라
챔피언 선택을 반영하게 된다. `tests/roleNeutrality.test.mjs` 가 이 성질을 지킨다.

## 시크릿

- **Vercel 의 Secret 타입 값은 어디서도 다시 볼 수 없다.** 대시보드도, `env pull`
  도, `env run` 도 `[SENSITIVE]` 만 준다. 값이 필요하면 다른 사본을 찾거나 새로
  발급해야 한다.
- `LCU_SYNC_SECRET` 은 Windows PC 의 OS 환경변수에도 있다(에이전트가 쓴다).
  그래서 그 PC 에서는 `.env.local` 에 안 넣어도 Next 가 읽는다.
- `RIOT_API_KEY`와 `SYNC_SECRET`은 현행 LCU 전용 운영에 필요하지 않다.
  `/api/sync`는 410으로 사용 중단을 알리고, Riot 예약 수집 워크플로는 제거했다.

로컬에서 대시보드만 띄우려면 `.env.local` 에 세 개면 된다:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
Vercel에는 위 세 개와 `LCU_SYNC_SECRET`을 설정한다. `RIOT_ROUTING`/`RIOT_REGION`
은 `config.ts`의 상수이며 환경변수로 읽지 않는다.

## 알려진 미해결

- **아이템은 저장만 하고 점수에 쓰지 않는다.** `item_ids` 는 두 경로 모두
  기록한다. 빌드를 점수에 어떻게 넣을지 정하지 못해 미뤄 둔 상태고, 원본이
  없으면 소급이 불가능하므로(아래 `cc_score` 가 그랬다) 수집만 먼저 해 둔다.
- **홈은 여전히 조회한 전체 경기를 클라이언트로 직렬화한다.** Supabase 조회
  자체는 `GAMES_CACHE_TAG` 로 캐시되지만, 집계를 서버로 옮기지 않는 한 payload
  는 경기 수에 비례해 계속 커진다.
- **2026-09-06 이전 경기의 `cc_score` 는 전부 0.** 에이전트가 LCU 의
  `totalTimeCrowdControlDealt` 대신 Match-V5 의 `totalTimeCCDealt` 를 읽던 버그였다.
  지금은 고쳐졌지만 원본이 없어 백필 불가. Riot Match-V5 는 과거 기록에 CC 를
  제대로 주므로, `/api/sync` 에 기존 경기 갱신 로직을 넣으면 소급 복구는 가능하다.
- **서포터 역할 보정이 없다.** 표본이 3건뿐이라 1.0 으로 뒀다. 서포터 픽이 쌓이면
  `ROLE_CALIBRATION` 을 다시 계산해야 한다(역할별 `relative` 평균).
- **대시보드의 기록 새로고침은 수집을 실행하지 않는다.** 서버 액션은 Supabase
  조회 캐시만 갱신한다. 새 경기는 Windows LCU 에이전트로 전송한다.
- `DDRAGON_VERSION`(`config.ts`)은 이미지 URL 용 고정값이다. 이름·역할 조회는
  `lib/ddragon.ts` 가 최신 버전을 런타임에 해석한다. 신규 챔피언 아이콘이 깨지면
  이 상수를 올린다.

## 스키마

정본은 `supabase/migrations/` 다. 파일명 날짜 순서대로 적용하면 현재 상태가
나온다. 예전에는 `supabase/schema.sql` 이 따로 있어 어느 쪽이 실제 DB 와 같은지
알 수 없었다.

자세한 설계 근거와 수치는 `README.md`, 현황 정리는 `docs/current-state-audit.md`.
