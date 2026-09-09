import { notFound } from 'next/navigation'
import { fetchGames, fetchPlayers, getCachedNicknames } from '@/lib/games'
import { fetchChampionCatalog } from '@/lib/championNames'
import PlayerProfile from '@/components/PlayerProfile'
import { validDate } from '@/lib/experience'

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ puuid: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { puuid } = await params
  const query = await searchParams
  const [games, players, catalog, nicknames] = await Promise.all([
    fetchGames(),
    fetchPlayers(),
    fetchChampionCatalog(),
    getCachedNicknames(),
  ])
  const player = players.find((p) => p.puuid === puuid)
  if (!player) notFound()
  return (
    <PlayerProfile
      player={player}
      games={games}
      catalog={catalog}
      nicknames={nicknames.filter((n) => n.winnerPuuid === puuid)}
      returnDate={validDate(query.date) ? query.date : undefined}
    />
  )
}
