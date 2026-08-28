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

// Only collect games from this date onwards (KST 2026-08-28 00:00)
export const DATA_START_DATE = new Date('2026-08-28T00:00:00+09:00')

export const RIOT_ROUTING = 'asia'
export const RIOT_BASE = `https://${RIOT_ROUTING}.api.riotgames.com`
export const DDRAGON_VERSION = '14.24.1'
export const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`
