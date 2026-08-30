import Link from 'next/link'
import { getServerGames } from '@/lib/serverData'

export const dynamic = 'force-dynamic'

export default async function DataStatusPage() {
  const games = await getServerGames()
  const complete = games.filter(game => game.game_results.filter(result => result.players).length >= 4).length
  const partial = games.length - complete
  const latest = games[0]?.played_at
  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm font-medium text-blue-600">← 홈으로</Link>
      <header>
        <p className="text-sm font-semibold text-blue-600">DATA STATUS</p>
        <h1 className="mt-1 text-2xl font-bold text-[#191f28]">데이터 상태</h1>
        <p className="mt-1 text-sm text-[#6b7684]">웹 화면이 실제 저장 데이터에서 계산한 상태입니다.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="데이터 상태 요약">
        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-4"><p className="text-sm text-[#6b7684]">저장 경기</p><p className="mt-2 text-2xl font-bold text-[#191f28]">{games.length}</p></div>
        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-4"><p className="text-sm text-[#6b7684]">4인 완전 경기</p><p className="mt-2 text-2xl font-bold text-emerald-700">{complete}</p></div>
        <div className="rounded-2xl border border-[#e5e8eb] bg-white p-4"><p className="text-sm text-[#6b7684]">부분 경기</p><p className="mt-2 text-2xl font-bold text-amber-700">{partial}</p></div>
      </section>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-bold text-amber-950">현재 확인 가능한 범위</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-900">
          <li>경기 시각은 저장된 UTC 값을 한국 시간으로 표시합니다.</li>
          <li>패치 버전, 수신 시각, 팀 전체 킬, 감소 피해, 아군 보호막은 원본 필드가 없어 계산하지 않습니다.</li>
          <li>최근 저장 경기: {latest ? new Date(latest).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '없음'}</li>
        </ul>
      </section>
    </div>
  )
}
