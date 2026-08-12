import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Route } from '../types/api'

// SC-06 경로 상세 — 구간별 타임라인
export default function RouteDetail() {
  const { routeId } = useParams()
  const nav = useNavigate()
  const [route, setRoute] = useState<Route | null>(null)

  useEffect(() => {
    api.getRoutes({ from: '', to: '' }).then((d) => {
      setRoute(d.routes.find((r) => r.route_id === routeId) ?? d.routes[0] ?? null)
    })
  }, [routeId])

  if (!route) return <div className="page"><div className="card skeleton">불러오는 중…</div></div>

  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>경로 상세</h1>
      <p className="muted">노출 부하 {route.exposure_load} · 야외 {route.outdoor_minutes}분</p>

      <ol className="timeline">
        {route.segments.map((s) => (
          <li key={s.seq} className={s.outdoor ? 'seg outdoor' : 'seg indoor'}>
            <span className="seg-type">{s.type}</span>
            <span className="seg-min">{s.minutes}분</span>
            {s.outdoor && s.exposure_minutes > 0 && <span className="seg-exp">야외 {s.exposure_minutes}분</span>}
          </li>
        ))}
      </ol>

      <button className="btn primary sticky" onClick={() => nav('/trip')}>이 경로로 이동</button>
    </div>
  )
}
