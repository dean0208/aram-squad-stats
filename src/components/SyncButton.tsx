'use client'

import { useState } from 'react'

export default function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ synced: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/sync')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setResult(data)
      window.setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1" aria-live="polite">
      <button
        onClick={handleSync}
        disabled={loading}
        aria-busy={loading}
        aria-label={loading ? '게임 기록 동기화 중' : '새 게임 기록 동기화'}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? '⟳ 동기화 중...' : '⟳ 게임 동기화'}
      </button>
      {result && (
        <span className="text-sm text-gray-400">
          ✓ 새 게임 {result.synced}개 · 건너뜀 {result.skipped}개
        </span>
      )}
      {error && (
        <span className="max-w-48 text-right text-sm text-red-400">✗ 동기화 실패: {error}</span>
      )}
    </div>
  )
}
