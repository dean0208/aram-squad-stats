import { syncNewGames } from '@/lib/riot'

export async function GET() {
  try {
    const result = await syncNewGames()
    return Response.json(result)
  } catch (err) {
    console.error('Sync error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
