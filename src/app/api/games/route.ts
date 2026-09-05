import { NextRequest } from 'next/server'
import { clampGameLimit, fetchGames } from '@/lib/games'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const games = await fetchGames(clampGameLimit(searchParams.get('limit')))
    return Response.json(games)
  } catch (err) {
    console.error('Games API error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
