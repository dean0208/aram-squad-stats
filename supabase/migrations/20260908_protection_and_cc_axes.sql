-- 점수 축 세 개를 실측 가능한 형태로 바꾸기 위한 컬럼들.
--
-- 배경: 221경기를 분석해 보니 역할 "사이" 편차는 ±0.1 로 잡혔는데 역할 "안"
-- 편차가 25점(=2 표준편차)이었다. 원인은 가중치가 아니라 축이 재는 대상이
-- 챔피언 킷에 따라 통째로 빠지는 것이었다.
--
-- 세 컬럼 모두 Riot Match-V5 응답에 이미 있는 값이라 과거 경기도 match_id 로
-- 다시 읽어 채울 수 있다. cc_score 와 heals_on_teammates 도 같은 경로로
-- 백필한다 (`/api/backfill`).

-- ── 1. 팀원에게 준 실드 ─────────────────────────────────────────────────────
--
-- "팀을 지킨 양" 을 힐 한쪽으로만 재고 있었다. 룰루 E, 레나타 W, 세라핀 W 는
-- 힐이 아니라 실드라 주력 기여가 통째로 0 으로 잡혔다. 실측:
--
--   Soraka  힐지분 69% → 75.7점      Seraphine 힐지분 20% → 55.4점
--   Nami    힐지분 55% → 69.1점      Lulu      힐지분 21% → 44.2점
--   Milio   힐지분 41% → 69.2점      Renata    힐지분 17% → 45.0점
--
-- 점수가 플레이가 아니라 "킷이 힐이냐 실드냐" 를 재고 있었다.
-- 힐과 같은 HP 단위라 더해서 하나의 "보호" 축으로 쓴다.
alter table game_results add column if not exists shields_on_teammates int;

comment on column game_results.shields_on_teammates is
  '팀원에게 준 실드량 (HP). 힐과 더해 보호 축을 이룬다. NULL 이면 미수집.';

-- ── 2. 하드 CC 횟수 ─────────────────────────────────────────────────────────
--
-- cc_score 는 `totalTimeCCDealt` = CC 지속시간이다. 지속시간만 쓰면 마오카이·
-- 오른 같은 긴 소프트 CC 가 말파이트·블리츠크랭크 같은 순간 하드 CC 를 이긴다.
-- 궁 한 방으로 한타를 여는 플레이가 점수는 더 낮아진다.
--
-- challenges.enemyChampionImmobilizations = 적을 실제로 묶은 횟수.
-- 지속시간과 절반씩 섞어 두 종류의 CC 를 모두 센다.
alter table game_results add column if not exists hard_cc_count int;

comment on column game_results.hard_cc_count is
  '적을 묶은 횟수 (challenges.enemyChampionImmobilizations). cc_score(지속시간)와 절반씩 섞는다. NULL 이면 미수집.';

-- ── 3. 막아낸 피해 ──────────────────────────────────────────────────────────
--
-- 탱커 점수가 사실상 damage_taken 하나로 정해지고 있었다. 실측에서 피해흡수
-- 지분과 점수가 거의 1:1 이라, 어그로를 끌어서 맞은 건지 그냥 던진 건지
-- 구분되지 않았다 (말파이트 흡수 21% → 44.5점, 오른 46% → 73.5점).
--
-- damageSelfMitigated = 방어력·마방·보호막·감쇄로 실제로 막아낸 양.
-- "맞은 것" 과 "버틴 것" 을 함께 봐야 탱킹이 측정된다.
alter table game_results add column if not exists damage_self_mitigated int;

comment on column game_results.damage_self_mitigated is
  '방어 스탯·스킬로 막아낸 피해량. damage_taken 과 절반씩 섞어 탱킹 축을 이룬다. NULL 이면 미수집.';
