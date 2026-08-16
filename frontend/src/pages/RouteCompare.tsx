import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import KakaoMap from '../components/KakaoMap'
import { api } from '../api/client'
import { useSession } from '../store/session'
import type { RoutesResponse } from '../types/api'

const gradeLabel: Record<string, string> = {
  precise: '정밀 예측',
  realtime: '실시간',
  estimated: '추정',
}

const FROM = '37.2011,127.0983' // 동탄역 (데모 구간)
const TO = '37.4979,127.0276' // 강남역

// SC-05 경로 비교 결과 (핵심 화면 · 실 /api/routes + 지도 폴리라인)
export default function RouteCompare() {
  const nav = useNavigate()
  const preset = useSession((s) => s.preset)
  const [data, setData] = useState<RoutesResponse | null>(null)
  const [sort, setSort] = useState<'exposure' | 'duration' | 'recommend'>('recommend')
  const [weather, setWeather] = useState<'mild' | 'uv_high'>('mild')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    setSelectedId(null)
    api
      .getRoutes({ from: FROM, to: TO, preset, sort, demo_weather: weather === 'uv_high' ? 'uv_high' : 'clear' })
      .then((d) => {
        setData(d)
        setSelectedId(d.routes.find((r) => r.recommended)?.route_id ?? d.routes[0]?.route_id ?? null)
      })
      .catch(() => setError('이 구간은 대중교통 경로를 찾지 못했어요'))
  }, [sort, weather, preset])

  const env = data?.environment
  const selected = useMemo(
    () => data?.routes.find((r) => r.route_id === selectedId),
    [data, selectedId],
  )
  const polyline = selected?.polyline
  const center = polyline?.[0]
    ? { lat: polyline[0][0], lng: polyline[0][1] }
    : { lat: 37.2011, lng: 127.0983 }

  return (
    <div className="page">
      <header className="page-head">
        <button className="link" onClick={() => nav(-1)}>← 홈</button>
        <div className="weather-toggle" role="group" aria-label="데모 날씨">
          <button className={weather === 'mild' ? 'on' : ''} onClick={() => setWeather('mild')}>☀️ 맑음</button>
          <button className={weather === 'uv_high' ? 'on' : ''} onClick={() => setWeather('uv_high')}>🔥 폭염·자외선</button>
        </div>
      </header>

      {polyline && polyline.length > 1 && (
        <div className="route-map">
          <KakaoMap center={center} polyline={polyline} />
        </div>
      )}

      {env && (
        <div className={'env-strip' + (weather === 'uv_high' ? ' env-strip--hot' : '')}>
          UV {env.uv ?? '-'} · 체감 {env.feels_like ?? '-'}° · 미세 {env.pm10_grade}
        </div>
      )}

      <div className="sort-toggle">
        <button className={sort === 'recommend' ? 'on' : ''} onClick={() => setSort('recommend')}>추천순</button>
        <button className={sort === 'exposure' ? 'on' : ''} onClick={() => setSort('exposure')}>노출순</button>
        <button className={sort === 'duration' ? 'on' : ''} onClick={() => setSort('duration')}>시간순</button>
      </div>

      {error && <p className="empty">{error}</p>}
      {!error && !data && <div className="card skeleton">경로 계산 중…</div>}

      {!error &&
        data?.routes.map((r) => (
          <div
            key={r.route_id}
            className={'card route-card' + (r.route_id === selectedId ? ' route-card--sel' : '')}
            onClick={() => setSelectedId(r.route_id)}
          >
            <div className="route-top">
              <div className="score">
                <strong>{r.exposure_load}</strong>
                <small>노출 부하</small>
              </div>
              {r.recommended && <span className="badge rec">추천</span>}
              <span className="badge grade">{gradeLabel[r.prediction_grade] ?? r.prediction_grade}</span>
              <button className="detail-link" onClick={(e) => { e.stopPropagation(); nav(`/routes/${r.route_id}`) }}>상세 →</button>
            </div>
            <div className="route-meta">
              <span>야외 {r.outdoor_minutes}분</span>
              <span>실내 {Math.round(r.indoor_ratio * 100)}%</span>
              <span>{r.total_minutes}분 · 환승 {r.transfers}</span>
            </div>
            {r.llm_comment && <p className="llm">{r.llm_comment}</p>}
          </div>
        ))}
    </div>
  )
}
