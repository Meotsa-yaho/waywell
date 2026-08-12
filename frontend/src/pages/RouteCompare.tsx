import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { RoutesResponse } from '../types/api'

const gradeLabel: Record<string, string> = {
  precise: '정밀 예측',
  realtime: '실시간',
  estimated: '추정',
}

// SC-05 경로 비교 결과 (핵심 화면)
export default function RouteCompare() {
  const nav = useNavigate()
  const [data, setData] = useState<RoutesResponse | null>(null)
  const [sort, setSort] = useState<'exposure' | 'duration'>('exposure')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    api
      .getRoutes({ from: '37.2011,127.0983', to: '37.4979,127.0276', sort })
      .then(setData)
      .catch(() => setError('이 구간은 대중교통 경로를 찾지 못했어요'))
  }, [sort])

  if (error) return <div className="page"><p className="empty">{error}</p></div>
  if (!data) return <div className="page"><div className="card skeleton">경로 계산 중…</div></div>

  return (
    <div className="page">
      <header className="page-head">
        <button className="link" onClick={() => nav(-1)}>← 홈</button>
        <div className="sort-toggle">
          <button className={sort === 'exposure' ? 'on' : ''} onClick={() => setSort('exposure')}>노출 부하순</button>
          <button className={sort === 'duration' ? 'on' : ''} onClick={() => setSort('duration')}>도착 시간순</button>
        </div>
      </header>

      {data.routes.map((r) => (
        <button key={r.route_id} className="card route-card" onClick={() => nav(`/routes/${r.route_id}`)}>
          <div className="route-top">
            <div className="score">
              <strong>{r.exposure_load}</strong>
              <small>노출 부하</small>
            </div>
            {r.recommended && <span className="badge rec">추천</span>}
            <span className="badge grade">{gradeLabel[r.prediction_grade] ?? r.prediction_grade}</span>
          </div>
          <div className="route-meta">
            <span>야외 {r.outdoor_minutes}분</span>
            <span>실내 {Math.round(r.indoor_ratio * 100)}%</span>
            <span>{r.total_minutes}분 · 환승 {r.transfers}</span>
          </div>
          {r.llm_comment && <p className="llm">{r.llm_comment}</p>}
        </button>
      ))}
    </div>
  )
}
