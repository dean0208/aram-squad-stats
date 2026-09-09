'use client'

import { useState } from 'react'
import Image from 'next/image'
import { DDRAGON_VERSION, getPlayerPhoto } from '@/lib/config'

export function ChampionAvatar({
  name,
  label,
  size = 40,
}: {
  name: string
  label?: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  return failed ? (
    <span
      className="avatar-fallback"
      style={{ width: size, height: size }}
      aria-label={label ?? name}
    >
      ?
    </span>
  ) : (
    <Image
      src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${name.replace(/[^a-zA-Z0-9]/g, '')}.png`}
      alt={label ?? name}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
      className="champion-avatar"
    />
  )
}

export function PlayerAvatar({
  puuid,
  name,
  size = 40,
}: {
  puuid: string
  name: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const src = getPlayerPhoto(puuid)
  return src && !failed ? (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="player-avatar"
    />
  ) : (
    <span className="avatar-fallback" style={{ width: size, height: size }}>
      {name.slice(0, 1)}
    </span>
  )
}

export function ScoreHelp() {
  return (
    <details className="score-help">
      <summary>기여도는 어떻게 보나요?</summary>
      <p>
        0~100점으로 표시하는 우리 스쿼드 내 기여도입니다. 딜·탱킹·보호·CC 등을
        역할에 맞춰 평가합니다. 승률과 함께 봐주세요.
      </p>
      <p>
        ‘이날 최고의 한 판’은 선택한 날짜의 단일 경기 최고점입니다. 상승·하락은
        개인의 전체 평균과 이날 평균의 차이입니다.
      </p>
    </details>
  )
}
