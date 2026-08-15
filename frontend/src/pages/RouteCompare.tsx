import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { RoutesResponse } from '../types/api'

const gradeLabel: Record<string, string> = {
  precise: '정밀 예측',
  realtime: '실시간',
  estimated: '추정',
}

// SC-05 경로 비교 결과 (핵심 화면 · 데모 킬러 장면)
export default function RouteCompare() {
  const nav = useNavigate()
  const [data, setData] = useState<RoutesResponse | null>(null)
  const [sort, setSort] = useState<'exposure' | 'duration'>('exposure')
  const [weather, setWeather] = useState<'mild' | 'uv_high'>('mild')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    api
      .getRoutes({
        from: '37.2011,127.0983',
        to: '37.4979,127.0276',
        sort,
        demo_weather: weather === 'uv_high' ? 'uv_high' : undefined,
      })
      .then(setData)
      .catch(() => setError('이 구간은 대중교통 경로를 찾지 못했어요'))
  }, [sort, weather])

  const env = data?.environment

  return (
    <div className="page">
      <header className="page-head">
        <button className="link" onClick={() => nav(-1)}>← 홈</button>
        {/* 데모 모드: 날씨 토글 (E-06 / F-12) */}
        <div className="weather-toggle" role="group" aria-label="데모 날씨">
          <button className={weather === 'mild' ? 'on' : ''} onClick={() => setWeather('mild')}>☀️ 맑음</button>
          <button className={weather === 'uv_high' ? 'on' : ''} onClick={() => setWeather('uv_high')}>🔥 폭염·자외선</button>
        </div>
      </header>

      {env && (
        <div className={'env-strip' + (weather === 'uv_high' ? ' env-strip--hot' : '')}>
          UV {env.uv} · 체감 {env.feels_like}° · 미세 {env.pm10_grade}
        </div>
      )}

      <div className="sort-toggle">
        <button className={sort === 'exposure' ? 'on' : ''} onClick={() => setSort('exposure')}>노출 부하순</button>
        <button className={sort === 'duration' ? 'on' : ''} onClick={() => setSort('duration')}>도착 시간순</button>
      </div>

      {error && <p className="empty">{error}</p>}
      {!error && !data && <div className="card skeleton">경로 계산 중…</div>}

      {!error &&
        data?.routes.map((r) => (
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
