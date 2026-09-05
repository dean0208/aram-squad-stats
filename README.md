# ARAM Squad Stats

칼바람 나락(ARAM Mayhem) 4인 스쿼드 전적 대시보드.

## 프로젝트 구조

| 경로 | 설명 |
| --- | --- |
| `src/app` | Next.js App Router 페이지 및 API 라우트 |
| `src/lib` | 점수 계산, 인사이트, Riot/LCU 매핑 등 도메인 로직 |
| `src/components` | 대시보드 UI 컴포넌트 |
| `tests` | `node --test` 기반 순수 로직 테스트 |
| `supabase` | DB 스키마 및 마이그레이션 |
| `docs` | 현황 감사 문서, 통계 용어 사전 |
| `lcu-agent` | 롤 클라이언트에서 전적을 수집해 서버로 보내는 Windows 로컬 에이전트 — [설치·실행 가이드](lcu-agent/README.md) |

## 데이터 조회 레이어

경기 조회는 전부 `src/lib/games.ts` 한 곳을 거칩니다.

| 함수 | 용도 |
| --- | --- |
| `fetchGames(limit)` | 최신순 경기 목록. 중첩 플레이어는 `puuid`/`game_name`만 선택 |
| `fetchGameById(id)` | 경기 상세. `tag_line`까지 포함한 전체 컬럼 |
| `getCachedNicknames()` | 스쿼드 마일스톤. `GAMES_CACHE_TAG`로 캐시 |

`getCachedNicknames()`는 동기화가 성공했을 때만 무효화됩니다 —
`/api/sync`와 `/api/lcu-sync`가 `revalidateTag(GAMES_CACHE_TAG, { expire: 0 })`을 호출합니다.

## API 엔드포인트

| 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /api/games?limit=` | 없음 | 경기 목록 (limit 최대 500) |
| `GET /api/games/[id]` | 없음 | 경기 상세 |
| `GET /api/players/badges?limit=` | 없음 | 마일스톤 수상 목록 |
| `GET /api/players/[puuid]/report` | 없음 | 플레이어 챔피언 리포트 |
| `GET /api/last-sync` | 없음 | 마지막 저장 경기 시점 (에이전트가 사용) |
| `GET /api/sync` | 없음 | Riot API에서 신규 경기 수집 |
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

**서포터는 표본이 3건뿐이라 보정하지 않았다.** 픽 성향이 바뀌면
`ROLE_CALIBRATION` 을 다시 계산해야 한다 — 역할별 `relative` 평균을 구해 그 값을
넣으면 된다.

### 그 외 주의할 점

- **역할 판정은 DDragon 태그**를 쓴다 (`src/lib/championRoles.ts`). 하드코딩 목록만 쓰던 시절에는 실제 픽의 32%만 판정됐다. 목록은 조회 실패 시 폴백으로만 남아 있다.
- **팀 합계가 0인 지표는 정규화 분모에서도 뺀다.** 어떤 지표가 수집되지 않는 구간이 생겨도 점수 눈금이 흔들리지 않는다. CC는 실제로 오래 0으로 저장되어 있었다.
- **절대 성과는 팀 단위로만 잰다.** 개인 딜량을 쓰면 탱커·서포터가 역할 때문에 구조적으로 손해를 본다.
- 저장되는 `game_results` 에는 추적 4인만 남으므로, 수집과 재계산이 **모두 4인 기준**으로 계산한다. 한쪽만 10인 기준으로 두면 같은 경기의 점수가 재현되지 않는다.

`toDisplayContributionScore` 는 반올림만 한다. 모델이 이미 100점 기준이다.

> **상수를 바꾸면 반드시 재계산해야 한다.** 아래 참고.

## 저장 점수 재계산

점수 모델 상수를 바꾼 뒤, 또는 이름이 안 풀린 챔피언을 복구하려면:

```bash
curl -X POST https://aram-squad-stats.vercel.app/api/recalculate-scores \
  -H "x-lcu-sync-secret: <REPLACE_WITH_SECRET_MANAGER>"
```

응답의 `updated` 는 갱신된 결과 수, `renamed` 는 이름을 복구한 챔피언 수다.
실행 후 캐시는 자동으로 무효화된다.

## 메달과 마일스톤

- **메달**(`src/lib/medals.ts`)은 나머지 참가자 평균 대비 배수 기준을 넘어야 발급된다. 스탯별 자연 분산이 달라 기준을 따로 잡았고(골드 1.1배, 힐량 3배), 누적 표본에서 발급률이 대략 절반이 되는 지점이다. MVP만 항상 발급한다.
- **마일스톤**(`src/lib/nicknames.ts`)은 2위와의 격차를 함께 보여준다. 4명이 항상 같은 수를 뛰어 누적 총량이 잘 수렴하고, 실측에서 어시스트 1위 격차는 1.1% 였다. 5% 미만이면 "접전"으로 표시한다.

## 전적 동기화

전적은 `lcu-agent/실행.bat`을 통해 수집되어 `/api/lcu-sync`로 전송됩니다.
설치 방법과 오류 대응은 [`lcu-agent/README.md`](lcu-agent/README.md)를 참고하세요.

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
