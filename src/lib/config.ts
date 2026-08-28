// Fixed player configuration
export const TRACKED_PLAYERS = [
  {
    puuid: 'ty6kwEB5XeaTnlYFnrzaoga5n2k2HVlTsMb_INWzWsOUNAyXGY6xemQcSXTFLcCWVhJ-2MgeAAXLmw',
    gameName: 'Hoodville',
    tagLine: 'cityb',
  },
  {
    puuid: 'S-fCtWgRYYQng5SMbXkpqkFtpLb9G09z8iHKvAWnDpWB6n64PhG0kij5ZxUlaANUQ1_Xg-FHUS6Ydg',
    gameName: 'Interest Rate',
    tagLine: 'OC',
  },
  {
    puuid: '-K-_p4PdtKq9J0UAki1Qks1J36heN4QryIMUadPXHPQ97_ilNqXVNPuaW6iyjscwlsUIvj8U_BTQDA',
    gameName: 'Nunu and Lulu',
    tagLine: 'OC',
  },
  {
    puuid: 'GTq3uwMxAnY5Fcti6DKKSMCMBz0Pu8BS3BHgN0V8JjyFnHiG1tLLP6orWeWeSjZJkStnFQoyWXrAXg',
    gameName: 'just won lotto',
    tagLine: 'OC',
  },
]

export const TRACKED_PUUIDS = new Set(TRACKED_PLAYERS.map((p) => p.puuid))

export const RIOT_ROUTING = 'asia'
export const RIOT_BASE = `https://${RIOT_ROUTING}.api.riotgames.com`
export const DDRAGON_VERSION = '14.24.1'
export const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}`
