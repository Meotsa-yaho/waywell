import type { RouteSegment } from '../types/api'

// ODsay 호선명은 "수도권 신분당선" 처럼 접두어가 붙음 → 정리
export function cleanLine(name?: string): string {
  return (name ?? '').replace(/^수도권\s*/, '').trim()
}

// 카드용 압축 요약: 핵심 이동수단만 (도보·대기·환승 생략)
export function modeChips(segments: RouteSegment[]): string[] {
  const chips: string[] = []
  for (const s of segments) {
    if (s.type === 'subway') chips.push(`🚇 ${cleanLine(s.line)}`)
    else if (s.type === 'bus') chips.push(`🚌 ${s.route_name ?? ''}번`)
  }
  return chips
}

// 상세 타임라인용: 한 구간을 아이콘 + 제목 + 설명 문장으로
export function segmentLine(s: RouteSegment): { icon: string; title: string; sub: string } {
  const board = s.from?.name
  const alight = s.to?.name
  switch (s.type) {
    case 'subway':
      return { icon: '🚇', title: cleanLine(s.line), sub: `${board} 승차 → ${alight} 하차 · ${s.minutes}분` }
    case 'bus':
      return { icon: '🚌', title: `${s.route_name ?? ''}번`, sub: `${board} 승차 → ${alight} 하차 · ${s.minutes}분` }
    case 'bus_wait':
      return { icon: '⏳', title: '버스 대기', sub: `${s.station ?? ''} 정류장 · 약 ${s.minutes}분` }
    case 'transfer_walk':
      return { icon: '🔀', title: '환승 이동', sub: `실내 도보 ${s.minutes}분` }
    default: // walk
      return { icon: '🚶', title: '도보', sub: `${s.minutes}분${s.outdoor ? ' · 야외 노출' : ''}` }
  }
}
