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
        aria-label={
          loading ? '게임 기록 새로고침 중' : '저장된 게임 기록 새로고침'
        }
        className="button-secondary refresh-button"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 13 3l1 3 M4 12l1 3a8 8 0 0 0 13 3" />
        </svg>
        {loading ? '새로고침 중' : '새로고침'}
      </button>
      {refreshed && (
        <span className="text-sm muted">✓ 저장된 기록을 새로고침했습니다</span>
      )}
      {error && (
        <span className="max-w-48 text-right text-sm negative">
          ✗ 새로고침 실패: {error}
        </span>
      )}
    </div>
  )
}
