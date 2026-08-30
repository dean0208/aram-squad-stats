import Link from 'next/link'
import { getServerGames } from '@/lib/serverData'
import { computeNicknames } from '@/lib/nicknames'
import { getPlayerDisplayName } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function RecordsPage() {
  const awards = computeNicknames(await getServerGames())
  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm font-medium text-blue-600">← 홈으로</Link>
      <header>
        <p className="text-sm font-semibold text-blue-600">RECORDS</p>
        <h1 className="mt-1 text-2xl font-bold text-[#191f28]">기록과 별명</h1>
        <p className="mt-1 text-sm text-[#6b7684]">현재 저장된 전체 경기 기준 · 동률은 공동 기록</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {awards.map(award => (
          <article key={award.id} className="rounded-2xl border border-[#e5e8eb] bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">{award.emoji}</span>
              <div className="min-w-0">
                <h2 className="font-bold text-[#191f28]">{award.name}</h2>
                <p className="mt-1 text-sm text-[#4e5968]">{award.description}</p>
                <p className="mt-3 font-semibold text-blue-700">{getPlayerDisplayName(award.winnerPuuid, award.winner)}</p>
                <p className="mt-1 text-xs text-[#6b7684]">{award.valueLabel}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      {awards.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-[#6b7684]">아직 계산할 기록이 없습니다.</p>}
    </div>
  )
}
