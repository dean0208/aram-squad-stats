import { fetchGameById } from '@/lib/games'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const game = await fetchGameById(id)
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 })
    return Response.json(game)
  } catch (err) {
    console.error('Game detail API error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
