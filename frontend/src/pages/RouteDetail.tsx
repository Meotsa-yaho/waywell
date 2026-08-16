import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import KakaoMap from '../components/KakaoMap'
import { api } from '../api/client'
import { useRouteQuery } from '../store/route'
import { segmentLine } from '../lib/segments'
import type { Route } from '../types/api'

const DEMO_FROM = { lat: 37.2011, lng: 127.0983 }
const DEMO_TO = { lat: 37.4979, lng: 127.0276 }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// SC-06 경로 상세 — 지도 메인 + 상단 경로 전환 + 드래그 가능한 하단 상세시트
export default function RouteDetail() {
  const { routeId } = useParams()
  const nav = useNavigate()
  const [routes, setRoutes] = useState<Route[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(routeId ?? null)
  const [failed, setFailed] = useState(false)
  const fromP = useRouteQuery((s) => s.from) ?? DEMO_FROM
  const toP = useRouteQuery((s) => s.to) ?? DEMO_TO
  const fromParam = `${fromP.lat},${fromP.lng}`
  const toParam = `${toP.lat},${toP.lng}`

  // route-detail = 100dvh(탭바 없음) → 뷰포트 높이 기준. reserve = 상단 버튼바 밑 여백
  const rootRef = useRef<HTMLDivElement>(null)
  const topbarRef = useRef<HTMLDivElement>(null)
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const [reserve, setReserve] = useState(90)
  useEffect(() => {
    if (topbarRef.current) setReserve(Math.round(topbarRef.current.getBoundingClientRect().height) + 16)
  }, [])

  // 시트 스냅 높이 (collapsed=요약만, half=기본 펼침, full=버튼 바로 밑)
  const snaps = useMemo(
    () => ({ collapsed: 96, half: Math.round(vh * 0.45), full: vh - reserve }),
    [vh, reserve],
  )
  const [sheetH, setSheetH] = useState(() => Math.round(vh * 0.45)) // 기본 펼침
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startY: number; startH: number; lastY: number; moved: number } | null>(null)

  useEffect(() => {
    api
      .getRoutes({ from: fromParam, to: toParam, geometry: '1' })
      .then((d) => {
        setRoutes(d.routes)
        setSelectedId((cur) => (d.routes.some((r) => r.route_id === cur) ? cur : d.routes[0]?.route_id ?? null))
      })
      .catch(() => setFailed(true))
  }, [fromParam, toParam])

  const route = useMemo(
    () => routes?.find((r) => r.route_id === selectedId) ?? routes?.[0],
    [routes, selectedId],
  )

  const order = [snaps.collapsed, snaps.half, snaps.full]
  const nearestIdx = (h: number) =>
    order.reduce((best, v, i) => (Math.abs(v - h) < Math.abs(order[best] - h) ? i : best), 0)
  const settle = (target: number) => setSheetH(target)

  const onDown = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: sheetH, lastY: e.clientY, moved: 0 }
    setDragging(true)
    try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* 합성 포인터 무시 */ }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    d.lastY = e.clientY
    d.moved = Math.max(d.moved, Math.abs(e.clientY - d.startY))
    setSheetH(clamp(d.startH + (d.startY - e.clientY), snaps.collapsed, snaps.full))
  }
  const onUp = () => {
    const d = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (!d) return
    const delta = d.startY - d.lastY // + = 위로 끌어올림
    const cur = nearestIdx(d.startH)
    if (d.moved < 6) settle(order[(cur + 1) % 3]) // 탭 = 다음 단계 순환
    else if (delta > 20) settle(order[Math.min(cur + 1, 2)]) // 위로 → 한 단계 위
    else if (delta < -20) settle(order[Math.max(cur - 1, 0)]) // 아래로 → 한 단계 아래
    else settle(order[cur])
  }

  if (failed) return <div className="page"><p className="empty">경로를 찾지 못했어요.</p></div>
  if (!routes || !route) return <div className="page"><div className="card skeleton">불러오는 중…</div></div>

  const center = route.polyline?.[0]
    ? { lat: route.polyline[0][0], lng: route.polyline[0][1] }
    : { lat: 37.2011, lng: 127.0983 }
  const atFull = sheetH >= snaps.full - 4

  return (
    <div className="route-detail" ref={rootRef}>
      {/* 상단: 뒤로 + 경로 전환 버튼 */}
      <div className="detail-topbar" ref={topbarRef}>
        <button className="topbar-back" onClick={() => nav(-1)}>←</button>
        <div className="route-switch">
          {routes.map((r) => (
            <button
              key={r.route_id}
              className={'switch-btn' + (r.route_id === route.route_id ? ' on' : '')}
              onClick={() => setSelectedId(r.route_id)}
            >
              {r.recommended && <span className="switch-rec">추천</span>}
              <strong>{r.total_minutes}분</strong>
              <small>노출 {r.exposure_load}</small>
            </button>
          ))}
        </div>
        <button className="topbar-cta" onClick={() => nav('/trip')}>안내 시작</button>
      </div>

      {/* 메인: 지도 (framing은 half 기준으로 고정 → full에서도 안 구겨지고 전환 자연스러움) */}
      <div className="detail-map-full">
        <KakaoMap center={center} paths={route.path_segments} polyline={route.polyline} fitBottomPadding={snaps.half} />
      </div>

      {/* 하단: 드래그 가능한 상세시트 */}
      <div className={'detail-sheet' + (dragging ? ' dragging' : '')} style={{ height: sheetH }}>
        <div
          className="sheet-handle"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          role="button"
          aria-label="상세 시트 드래그"
        >
          <span className="sheet-grip" />
          <span className="sheet-summary-line">
            {route.total_minutes}분 · 야외 {route.outdoor_minutes}분 · 환승 {route.transfers} · 노출 {route.exposure_load}
            <span className="sheet-caret">{atFull ? '▾' : '▴'}</span>
          </span>
          {/* 지도 색상 범례 */}
          <span className="sheet-legend">
            <em className="lg lg-subway" /> 전철
            <em className="lg lg-bus" /> 버스
            <em className="lg lg-walk-out" /> 실외도보
            <em className="lg lg-walk-in" /> 실내도보
          </span>
        </div>

        <div className="sheet-body">
          <ol className="timeline detail-timeline">
            {route.segments.map((s) => {
              const { icon, title, sub } = segmentLine(s)
              return (
                <li key={s.seq} className={s.outdoor ? 'tl-item outdoor' : 'tl-item indoor'}>
                  <span className="tl-icon">{icon}</span>
                  <div className="tl-body">
                    <span className="tl-title">{title}</span>
                    <span className="tl-sub">{sub}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}
