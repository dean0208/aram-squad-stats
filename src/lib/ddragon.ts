import { DDRAGON_VERSION } from './config'

const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'

/**
 * 최신 DDragon 버전을 해석한다.
 *
 * 버전을 코드에 고정해두면 신규 챔피언이 나올 때마다 이름이 `Champion800`
 * 형태로 저장되고 아이콘도 깨진다. 서버 측 조회는 항상 최신을 쓰고,
 * 조회에 실패하면 config 의 고정 버전으로 물러난다.
 */
export async function fetchDDragonVersion(): Promise<string> {
  try {
    const res = await fetch(VERSIONS_URL, { next: { revalidate: 86400 } })
    if (!res.ok) return DDRAGON_VERSION
    const versions = (await res.json()) as string[]
    return versions[0] ?? DDRAGON_VERSION
  } catch {
    return DDRAGON_VERSION
  }
}

export async function fetchDDragonBase(): Promise<string> {
  return `https://ddragon.leagueoflegends.com/cdn/${await fetchDDragonVersion()}`
}
