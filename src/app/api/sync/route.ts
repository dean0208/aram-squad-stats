import { syncNewGames } from '@/lib/riot'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  // Allow Vercel cron (authorization header) or secret header from GitHub Actions
  const authHeader = req.headers.get('authorization')
  const syncSecret = req.headers.get('x-sync-secret')
  const cronSecret = process.env.CRON_SECRET

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const isGithubActions = syncSecret && syncSecret === process.env.SYNC_SECRET
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && !isVercelCron && !isGithubActions) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
