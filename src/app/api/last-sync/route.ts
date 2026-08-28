import { createServerClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('games')
      .select('played_at, match_id')
      .order('played_at', { ascending: false })
      .limit(1)
      .single()

    return Response.json({
      last_played_at: data?.played_at ?? null,
      last_match_id: data?.match_id ?? null,
    })
  } catch {
    return Response.json({ last_played_at: null, last_match_id: null })
  }
}
