/**
 * 하루의 상(오늘의 MVP·오늘의 걸배이) 연출을 언제 띄울지 정한다.
 *
 * 이 모듈은 의존성이 없다. 테스트가 `.mjs` 에서 `.ts` 를 직접 import 하므로
 * 확장자 없는 상대 import 를 쓰면 Node 의 ESM 리졸버가 찾지 못한다.
 */

/**
 * 같은 대상에 두 번 연출하지 않도록 쓰는 키.
 * 날짜를 포함해서, 어제 뽑힌 사람과 오늘 뽑힌 사람이 같아도 구분된다.
 */
export function celebrationKey(date: string, awardId: string): string {
  return `${date}:${awardId}`
}


// ─── 어떤 연출을 띄울지 ──────────────────────────────────────────────────────

export interface CelebrationInput {
  /** 화면에서 보고 있는 날짜 (KST, YYYY-MM-DD) */
  date: string
  /** 저장된 경기 중 가장 최근 날짜를 보고 있는가 */
  isLatestDate: boolean
  /** 그 날의 MVP game_result id. 없으면 null */
  mvpResultId: string | null
  /** 그 날의 걸배이 puuid. 없으면 null */
  anchorPuuid: string | null
  /** 이 브라우저가 마지막으로 축하한 MVP 키 */
  lastMvpKey: string | null
  /** 이 브라우저가 마지막으로 놀린 걸배이 키 */
  lastAnchorKey: string | null
}

export interface CelebrationPlan {
  /** 새로 뽑힌 MVP 키. 변동 없으면 null */
  mvpKey: string | null
  /** 새로 뽑힌 걸배이 키. 변동 없으면 null */
  anchorKey: string | null
}

/**
 * 갱신된 상을 골라 낸다. 띄울 게 없으면 null.
 *
 * 둘 다 바뀌었으면 화면을 반씩 나눠 함께 보여주고, 하나만 바뀌었으면 그쪽만
 * 단독으로 크게 띄운다 — 판단은 여기서 하고, 배치는 컴포넌트가 맡는다.
 *
 * 지난 날짜를 넘겨보는 동안에는 띄우지 않는다. 과거를 훑을 때마다 연출이
 * 뜨면 탐색을 방해하고, "바뀌었다"는 신호로도 읽히지 않는다.
 */
export function resolveCelebrationPlan(input: CelebrationInput): CelebrationPlan | null {
  if (!input.isLatestDate) return null

  const mvpKey = input.mvpResultId ? celebrationKey(input.date, input.mvpResultId) : null
  const anchorKey = input.anchorPuuid ? celebrationKey(input.date, input.anchorPuuid) : null

  const freshMvp = mvpKey && mvpKey !== input.lastMvpKey ? mvpKey : null
  const freshAnchor = anchorKey && anchorKey !== input.lastAnchorKey ? anchorKey : null

  if (!freshMvp && !freshAnchor) return null
  return { mvpKey: freshMvp, anchorKey: freshAnchor }
}

/** 로딩 아트는 버전이 없는 경로를 쓴다. */
export function championLoadingArtUrl(championName: string): string {
  const safe = championName.replace(/[^a-zA-Z0-9]/g, '')
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${safe}_0.jpg`
}
