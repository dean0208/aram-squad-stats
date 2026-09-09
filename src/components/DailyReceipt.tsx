'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { Game } from '@/lib/types'
import { getPlayerDisplayName } from '@/lib/config'
import { calculateMedals } from '@/lib/medals'
import { displayDate, sessionSummary } from '@/lib/experience'

export default function DailyReceipt({
  games,
  date,
  best,
  rise,
  anchor,
  onClose,
}: {
  games: Game[]
  date: string
  best: string
  rise: string
  anchor: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [png, setPng] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  useEffect(() => {
    let cancelled = false
    async function render() {
      await document.fonts.ready
      const { wins, losses, seconds, line } = sessionSummary(games)
      const counts = new Map<
        string,
        { name: string; medals: number; sum: number; count: number }
      >()
      for (const game of games) {
        for (const result of game.game_results) {
          if (!result.players) continue
          const { puuid, game_name } = result.players
          const entry = counts.get(puuid) ?? {
            name: getPlayerDisplayName(puuid, game_name),
            medals: 0,
            sum: 0,
            count: 0,
          }
          entry.sum += result.perf_score
          entry.count++
          counts.set(puuid, entry)
        }
        for (const award of calculateMedals(game.game_results))
          for (const winner of award.winners) {
            const entry = counts.get(winner.players?.puuid ?? '')
            if (entry) entry.medals++
          }
      }
      const canvas = document.createElement('canvas')
      canvas.width = 720
      canvas.height = 1100
      const ctx = canvas.getContext('2d')
      if (!ctx)
        throw new Error('이미지를 만들 수 없어요. 링크 복사를 이용해 주세요.')
      const fontFamily = getComputedStyle(document.body).fontFamily
      ctx.fillStyle = '#edf1f7'
      ctx.fillRect(0, 0, 720, 1100)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(32, 32, 656, 1036)
      ctx.fillStyle = '#182337'
      ctx.fillRect(32, 32, 656, 188)
      ctx.fillStyle = '#c7dcff'
      ctx.fillRect(616, 67, 14, 14)
      ctx.fillRect(636, 67, 14, 14)
      ctx.fillRect(616, 87, 14, 14)
      ctx.fillRect(636, 87, 14, 14)
      function text(
        value: string,
        x: number,
        y: number,
        size: number,
        color = '#182337',
        weight = 500,
      ) {
        ctx!.font = `${weight} ${size}px ${fontFamily}`
        ctx!.fillStyle = color
        ctx!.fillText(value, x, y, 592)
      }
      function rule(y: number) {
        ctx!.strokeStyle = '#c5d0e2'
        ctx!.setLineDash([5, 7])
        ctx!.beginPath()
        ctx!.moveTo(64, y)
        ctx!.lineTo(656, y)
        ctx!.stroke()
        ctx!.setLineDash([])
      }
      text('마 좀 치나?', 64, 100, 38, '#c7dcff', 800)
      text('우리의 나락 영수증', 64, 150, 22, '#ffffff', 650)
      text(`${displayDate(date)} · KST`, 64, 188, 18, '#c1cfe3')
      text(
        `${games.length}전  ${wins}승 ${losses}패`,
        64,
        300,
        48,
        '#182337',
        800,
      )
      text(
        `같이 뛴 시간 ${Math.floor(seconds / 60)}분 · 경기 시간 합계`,
        64,
        344,
        18,
        '#5e6b7d',
      )
      text(line, 64, 396, 24, '#315cce', 700)
      rule(428)
      text('이날 최고의 한 판', 64, 472, 17, '#5e6b7d')
      text(best, 64, 508, 28, '#315cce', 750)
      text(`평소보다 잘한 사람  ${rise}`, 64, 555, 20, '#16734d')
      text(`이날의 걸배이  ${anchor}`, 64, 595, 20, '#9f3c50')
      rule(629)
      text('함께한 사람들', 64, 669, 20, '#182337', 700)
      ;[...counts.values()].forEach((player, index) => {
        const y = 716 + index * 58
        text(player.name, 64, y, 22, '#182337', 700)
        text(
          `평균 ${Math.round(player.sum / player.count)}점 · 메달 ${player.medals}개`,
          300,
          y,
          19,
          '#5e6b7d',
        )
      })
      rule(944)
      text('기록은 남고, 다음 판은 온다.', 64, 984, 19, '#5e6b7d')
      text(`${window.location.host}/?date=${date}`, 64, 1024, 17, '#315cce')
      // Perforated ticket edges are decorative; all numbers above are real records.
      ctx.fillStyle = '#edf1f7'
      for (let x = 40; x < 688; x += 24) {
        ctx.beginPath()
        ctx.arc(x, 1068, 6, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const x of [32, 688]) {
        ctx.beginPath()
        ctx.arc(x, 629, 12, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!cancelled) setPng(canvas.toDataURL('image/png'))
    }
    render().catch((error) => {
      if (!cancelled) setMessage(error.message)
    })
    return () => {
      cancelled = true
    }
  }, [games, date, best, rise, anchor])

  async function copyLink() {
    const url = `${window.location.origin}/?date=${date}`
    try {
      await navigator.clipboard.writeText(url)
      setMessage('이 날짜의 링크를 복사했어요.')
    } catch {
      setLink(url)
      setMessage('아래 주소를 길게 눌러 복사해 주세요.')
    }
  }

  return (
    <dialog
      ref={dialog}
      className="receipt-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-labelledby="receipt-title"
    >
      <div className="receipt-content">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SAVE THE NIGHT</p>
            <h2 id="receipt-title">우리의 전적 영수증</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="영수증 닫기"
          >
            ×
          </button>
        </div>
        <p className="muted text-sm">
          선택한 날짜의 별명과 경기 기록을 한 장에 담았어요.
        </p>
        {png ? (
          <Image
            src={png}
            width={720}
            height={1100}
            unoptimized
            alt={`${displayDate(date)} 전적 영수증 미리보기`}
            className="receipt-preview"
          />
        ) : (
          <p role="status">영수증을 만드는 중…</p>
        )}
        <div className="flex flex-wrap gap-2">
          {png && (
            <a
              className="button-primary"
              href={png}
              download={`aram-${date}.png`}
            >
              이미지 저장 ↓
            </a>
          )}
          <button className="button-secondary" onClick={copyLink}>
            날짜 링크 복사
          </button>
        </div>
        <p className="muted text-sm" role="status">
          {message || '마음에 들면 저장해서 단톡방에 올려보세요.'}
        </p>
        {link && (
          <input
            aria-label="복사할 날짜 링크"
            className="field w-full"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        )}
      </div>
    </dialog>
  )
}
