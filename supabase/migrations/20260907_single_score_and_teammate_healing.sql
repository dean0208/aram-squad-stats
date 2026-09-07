-- 두 가지를 함께 정리한다. 한 번에 실행해도 안전하고, 이미 일부를 돌렸어도
-- (if exists / if not exists) 다시 돌릴 수 있다.

-- ── 1. 점수 컬럼을 하나로 ───────────────────────────────────────────────────
--
-- perf_score 와 contribution_score 는 도입 이후 같은 값이었다.
-- (`calcContributionScore` 가 계산된 perf 를 그대로 돌려줬다)
-- 코드는 이미 contribution_score 를 읽지 않는다 — 남은 건 컬럼뿐이다.
--
-- 참고: 2026-09-07 재계산은 perf_score 만 갱신했으므로 contribution_score 에는
-- 재계산 이전의 옛 점수가 남아 있다. 두 값이 갈린 건 컬럼이 낡았다는 뜻이지
-- 데이터가 상한 게 아니다. 유효한 값은 perf_score 다.
alter table game_results drop column if exists contribution_score;

-- ── 2. 자힐을 점수에서 뺀다 ─────────────────────────────────────────────────
--
-- healing 컬럼은 Riot 의 totalHeal 이라 물약·흡혈·자힐이 전부 섞여 있다.
-- 탐 켄치 65k, 오른 43k 는 전부 자기 자신을 회복한 값이고, 그만큼 팀 힐
-- 합계가 부풀어 실제로 팀을 살린 서포터의 지분이 희석됐다.
--
-- 팀원에게 준 힐만 담는 컬럼을 따로 만든다. healing 의 의미를 조용히 바꾸면
-- 옛 행과 새 행을 구분할 수 없게 되므로 덮어쓰지 않는다.
--
-- NULL  = 수집 이전 경기 (알 수 없음 → 점수는 healing 으로 폴백)
-- 숫자  = 팀원에게 준 힐만
--
-- 과거 경기는 원본이 없어 백필이 불가능하다. cc_score 와 같은 이유다.
alter table game_results add column if not exists heals_on_teammates int;

comment on column game_results.heals_on_teammates is
  '팀원에게 준 힐만 (자힐 제외). NULL 이면 수집 이전 경기라 healing 으로 폴백한다.';
