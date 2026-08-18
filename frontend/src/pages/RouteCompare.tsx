import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useSession } from '../store/session'
import { useRouteQuery } from '../store/route'
import { modeChips } from '../lib/segments'
import EmptyState from '../components/EmptyState'
import type { RoutesResponse } from '../types/api'

const gradeLabel: Record<string, string> = {
  precise: '정밀 예측',
  realtime: '실시간',
  estimated: '추정',
}

const DEMO_FROM = { lat: 37.2011, lng: 127.0983, name: '동탄역' } // 미선택 시 데모 구간
const DEMO_TO = { lat: 37.4979, lng: 127.0276, name: '강남역' }

function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmt(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 출발시각(HH:MM) → 오늘 기준 Date. 이미 지난 시각이면 내일로.
function departDate(hhmmStr: string): Date {
  const [h, m] = hhmmStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1)
  return d
}

// SC-05 경로 비교 결과 (핵심 화면 · 카드 중심 · 지도는 상세에서)
export default function RouteCompare() {
  const nav = useNavigate()
  const preset = useSession((s) => s.preset)
  const fromP = useRouteQuery((s) => s.from) ?? DEMO_FROM
  const toP = useRouteQuery((s) => s.to) ?? DEMO_TO
  const weather = useRouteQuery((s) => s.weather)
  const setWeather = useRouteQuery((s) => s.setWeather)
  const departAt = useRouteQuery((s) => s.departAt)
  const [data, setData] = useState<RoutesResponse | null>(null)
  const [sort, setSort] = useState<'exposure' | 'duration' | 'recommend'>('recommend')
  const [error, setError] = useState<string | null>(null)

  const fromParam = `${fromP.lat},${fromP.lng}`
  const toParam = `${toP.lat},${toP.lng}`

  useEffect(() => {
    setData(null)
    setError(null)
    api
      .getRoutes({
        from: fromParam, to: toParam, from_name: fromP.name, to_name: toP.name,
        preset, sort, demo_weather: weather === 'uv_high' ? 'uv_high' : 'clear',
      })
      .then(setData)
      .catch(() => setError('이 구간은 대중교통 경로를 찾지 못했어요'))
  }, [fromParam, toParam, sort, weather, preset])

  const env = data?.environment

  return (
    <div className="page">
      <header className="page-head">
        <button className="link" onClick={() => nav(-1)}>← 홈</button>
        <div className="weather-toggle" role="group" aria-label="데모 날씨">
          <button className={weather === 'mild' ? 'on' : ''} onClick={() => setWeather('mild')}>☀️ 맑음</button>
          <button className={weather === 'uv_high' ? 'on' : ''} onClick={() => setWeather('uv_high')}>🔥 폭염·자외선</button>
        </div>
      </header>

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

      {error && (
        <EmptyState icon="🧭" title={error} hint="출발지·도착지를 다시 확인하거나 다른 구간으로 시도해보세요."
          actionLabel="다시 검색" onAction={() => nav('/')} />
      )}
      {!error && !data && <div className="card skeleton">경로 계산 중…</div>}
      {!error && data && data.routes.length === 0 && (
        <EmptyState icon="🚏" title="추천할 경로가 없어요" hint="가까운 거리이거나 대중교통이 닿지 않는 구간일 수 있어요."
          actionLabel="다시 검색" onAction={() => nav('/')} />
      )}

      {!error &&
        data?.routes.map((r) => {
          const chips = modeChips(r.segments)
          return (
            <div
              key={r.route_id}
              className={'card route-card' + (r.recommended ? ' route-card--rec' : '')}
              onClick={() => nav(`/routes/${r.route_id}`)}
            >
              <div className="route-top">
                <div className="score">
                  <strong>{r.exposure_load}</strong>
                  <small>노출 부하</small>
                </div>
                <div className="route-headline">
                  <div className="route-badges">
                    {r.recommended && <span className="badge rec">추천</span>}
                    <span className="badge grade">{gradeLabel[r.prediction_grade] ?? r.prediction_grade}</span>
                  </div>
                  <div className="route-time">
                    <strong>{r.total_minutes}분</strong>
                    <span className="muted">
                      {' · '}
                      {departAt
                        ? `${departAt} 출발 · ${fmt(new Date(departDate(departAt).getTime() + r.total_minutes * 60000))} 도착`
                        : `${hhmm(r.arrival_time)} 도착`}
                      {' · 환승 '}
                      {r.transfers}
                    </span>
                  </div>
                </div>
                <span className="detail-chevron">›</span>
              </div>

              <div className="route-modes">
                {chips.map((c, i) => (
                  <span key={i} className="mode-chip">{c}</span>
                ))}
              </div>

              <div className="route-meta">
                <span>야외 {r.outdoor_minutes}분</span>
                <span>실내 {Math.round(r.indoor_ratio * 100)}%</span>
              </div>
              {r.llm_comment && <p className="llm">{r.llm_comment}</p>}
            </div>
          )
        })}
    </div>
  )
}
