// Fixed player configuration
export const TRACKED_PLAYERS = [
  {
    puuid: 'fMM-QQxR_KvThTZ-4xaqn_XzyPLrzBKx8qL-6lyw1OfyabCpv8NWGYMt_v836xmLJRhO1mO55RXilg',
    gameName: 'Hoodville',
    tagLine: 'cityb',
  },
  {
    puuid: 'XqEwGu2HFUiWqO8AOrAPfCfKxSl1BzSLcFxV0HFfVan_YvQvfEdbfnXrVkfErFHtq27-la-U9e_ZgA',
    gameName: 'Interest Rate',
    tagLine: 'OC',
  },
  {
    puuid: 'Mx8gYVhZwzugCoBFQyoCfjESRpjTF6ZJN-8uTF1hqHwc9s9ke5rGTKnWFvfYGa6z8tAWnIxMdytYPg',
    gameName: 'Nunu and Lulu',
    tagLine: 'OC',
  },
  {
    puuid: 'ScCA2JAvEUDKOL83IF0jnELmmCoPIWfi6qhZ6h-sTR7V18ZFgt8y4XhHHny3j5MXdowQlgPcsLjy2Q',
    gameName: 'just won lotto',
    tagLine: 'OC',
  },
]

export const TRACKED_PUUIDS = new Set(TRACKED_PLAYERS.map((p) => p.puuid))

// Display aliases are separate from Riot IDs so API/LCU matching stays intact.
export const PLAYER_DISPLAY_NAMES: Record<string, string> = {
  [TRACKED_PLAYERS[0].puuid]: '째지',
  [TRACKED_PLAYERS[1].puuid]: '허개굴',
  [TRACKED_PLAYERS[2].puuid]: '허말자씨',
  [TRACKED_PLAYERS[3].puuid]: '권선비',
}

export function getPlayerDisplayName(puuid: string, fallback: string): string {
  return PLAYER_DISPLAY_NAMES[puuid] ?? fallback
}

/**
 * 하루의 상(MVP·걸배이) 연출에서 크게 띄우는 플레이어 사진.
 *
 * 파일은 `public/players/` 에 넣는다. 정사각형에 가깝고 얼굴이 가운데 오도록
 * 잘라 두면 원형 마스크에 잘 맞는다. 파일이 없으면 이름 첫 글자를 대신
 * 세우므로, 넣지 않아도 화면은 깨지지 않는다.
 */
export const PLAYER_PHOTOS: Record<string, string> = {
  [TRACKED_PLAYERS[0].puuid]: '/players/jjeji.jpg',
  [TRACKED_PLAYERS[1].puuid]: '/players/heogaegul.png',
  [TRACKED_PLAYERS[2].puuid]: '/players/heomalja.png',
  [TRACKED_PLAYERS[3].puuid]: '/players/gwonseonbi.png',
}

export function getPlayerPhoto(puuid: string): string | null {
  return PLAYER_PHOTOS[puuid] ?? null
}

/**
 * 수집을 허용하는 큐. 480 = Swiftplay, 450 = ARAM, 2400 = ARAM Mayhem(증강).
 *
 * Riot 경로와 LCU 경로가 같은 목록을 봐야 한다. 예전에는 이 검사가 `riot.ts`
 * 안에만 있어서, LCU 로 들어온 경기는 큐 종류와 무관하게 저장됐다.
 */
export const SUPPORTED_QUEUES = [480, 450, 2400]

// Only collect games from this date onwards (2026-07-01 KST)
export const DATA_START_DATE = new Date('2026-07-01T00:00:00+09:00')

// Account API는 asia (OCE 포함 전 서버 지원)
export const ACCOUNT_BASE = 'https://asia.api.riotgames.com'

// Match API는 sea (OCE 서버 라우팅)
export const RIOT_ROUTING = 'sea'
export const RIOT_BASE = `https://${RIOT_ROUTING}.api.riotgames.com`
/**
 * 이미지 URL처럼 동기 컨텍스트에서 쓰는 고정 버전.
 * 서버 측 이름/역할 조회는 `lib/ddragon.ts` 가 최신 버전을 해석해 쓰므로,
 * 이 값은 신규 챔피언 아이콘이 깨질 때만 올려주면 된다.
 */
export const DDRAGON_VERSION = '16.17.1'
export const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`
