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
  [TRACKED_PLAYERS[2].puuid]: '말자허',
  [TRACKED_PLAYERS[3].puuid]: '권선비',
}

export function getPlayerDisplayName(puuid: string, fallback: string): string {
  return PLAYER_DISPLAY_NAMES[puuid] ?? fallback
}

// Only collect games from this date onwards (2026-07-01 KST)
export const DATA_START_DATE = new Date('2026-07-01T00:00:00+09:00')

// Account API는 asia (OCE 포함 전 서버 지원)
export const ACCOUNT_BASE = 'https://asia.api.riotgames.com'

// Match API는 sea (OCE 서버 라우팅)
export const RIOT_ROUTING = 'sea'
export const RIOT_BASE = `https://${RIOT_ROUTING}.api.riotgames.com`
export const DDRAGON_VERSION = '14.24.1'
export const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`
