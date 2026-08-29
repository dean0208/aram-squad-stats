export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="플레이어 상세 페이지 불러오는 중">
      <div className="h-5 w-28 rounded bg-gray-200" />
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
        <div className="h-8 w-36 rounded bg-gray-200" />
        <div className="mt-2 h-5 w-20 rounded bg-gray-200" />
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="h-4 w-20 rounded bg-blue-100" />
        <div className="mt-4 h-10 w-3/4 rounded bg-blue-100" />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <div className="h-6 w-40 rounded bg-gray-200" />
        <div className="mt-5 h-40 rounded bg-gray-200" />
      </div>
    </div>
  )
}
