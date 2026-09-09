'use client'

import { useState, useTransition } from 'react'
import { refreshGamesAction } from '@/app/actions'

export default function SyncButton() {
  const [loading, startTransition] = useTransition()
  const [refreshed, setRefreshed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRefresh = () => {
    setError(null)
    setRefreshed(false)
    startTransition(async () => {
      try {
        await refreshGamesAction()
        setRefreshed(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1" aria-live="polite">
      <button
        onClick={handleRefresh}
        disabled={loading}
        aria-busy={loading}
        aria-label={loading ? '게임 기록 새로고침 중' : '저장된 게임 기록 새로고침'}
        className="button-secondary"
      >
        {loading ? '⟳ 새로고침 중...' : '⟳ 기록 새로고침'}
      </button>
      {refreshed && (
        <span className="text-sm text-gray-400">✓ 저장된 기록을 새로고침했습니다</span>
      )}
      {error && (
        <span className="max-w-48 text-right text-sm text-red-400">✗ 새로고침 실패: {error}</span>
      )}
    </div>
  )
}
