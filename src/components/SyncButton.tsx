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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? '⟳ Syncing...' : '⟳ Sync Games'}
      </button>
      {result && (
        <span className="text-sm text-gray-400">
          ✓ {result.synced} new, {result.skipped} skipped
        </span>
      )}
      {error && (
        <span className="text-sm text-red-400">✗ {error}</span>
      )}
    </div>
  )
}
