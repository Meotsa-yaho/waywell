import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Arrival } from '../types/api'

type NotifPerm = NotificationPermission | 'unsupported'
const initNotifPerm = (): NotifPerm =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission

// 데모 정류소 — TAGO 실시간 도착이 나오는 세종 송강전통시장 (우리 데모 경로는 지하철이라 버스 노드가 없음)
const DEMO_STATION = 'DJB8001793'
const DEMO_CITY = '25'
const POLL_MS = 30_000

// SC-07 이동 중 / 환승 대기 — GET /api/arrival 폴링 (C-02)
export default function Trip() {
  const nav = useNavigate()
  const [data, setData] = useState<Arrival | null>(null)
  const [error, setError] = useState(false)
  const [notifPerm, setNotifPerm] = useState<NotifPerm>(initNotifPerm)
  const notifiedFor = useRef<number | null>(null) // 알림 보낸 차량 seq (중복 발송 방지)

  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .getArrival(DEMO_STATION, undefined, DEMO_CITY)
        .then((d) => alive && (setData(d), setError(false)))
        .catch(() => alive && setError(true))
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const next = data?.arrivals[0]
  const soon = next && next.minutes <= 3 // 실내 대기 알림 임계 (온보딩에서 약속한 3분 전)

  // C-05 도착 3분 전 알림: soon 진입 시 차량당 1회 발송
  useEffect(() => {
    if (!next || !soon || notifPerm !== 'granted') return
    if (notifiedFor.current === next.seq) return
    notifiedFor.current = next.seq
    new Notification('🚏 곧 도착해요', {
      body: `${data?.route_name ?? ''}번 · ${next.minutes}분 후 도착 · 실내에서 대기하세요`,
      icon: '/favicon.svg',
    })
  }, [next, soon, notifPerm, data])

  const enableNotif = () => {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then(setNotifPerm)
  }

  return (
    <div className="page">
      <h1>이동 중</h1>

      {notifPerm === 'default' && (
        <button className="notif-cta" onClick={enableNotif}>
          🔔 도착 3분 전 알림 받기 <span>탭하여 켜기</span>
        </button>
      )}
      {notifPerm === 'denied' && (
        <p className="notif-hint">🔕 알림이 꺼져 있어요. 브라우저 설정에서 허용하면 도착 알림을 받아요.</p>
      )}

      {error && <p className="empty">도착 정보를 불러오지 못했어요.</p>}
      {!error && !data && <div className="card skeleton">도착 정보 불러오는 중…</div>}

      {data && (
        <>
          <div className={'card big-timer' + (soon ? ' big-timer--soon' : '')}>
            <small>다음 차량까지</small>
            {next ? (
              <>
                <strong>{next.minutes}분</strong>
                <small>
                  {data.route_name}번 · {next.stations_left ?? '-'}정류장 전
                  {soon && ' · 곧 도착!'}
                </small>
              </>
            ) : (
              <strong style={{ fontSize: 22 }}>{data.notice ?? '도착 예정 없음'}</strong>
            )}
          </div>

          {data.arrivals.length > 1 && (
            <ul className="timeline">
              {data.arrivals.slice(1).map((a) => (
                <li key={a.seq} className="seg indoor">
                  <span className="seg-type">{a.route_name}번</span>
                  <span className="seg-min">{a.minutes}분 · {a.stations_left ?? '-'}정류장 전</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted">30초마다 갱신 · 실시간(TAGO)</p>
        </>
      )}

      <button className="card shelter-hint" onClick={() => nav('/trip/shelters')}>
        근처 실내 대기 장소 보기 →
      </button>
      <button
        className="btn"
        onClick={() => {
          // 이동 완료 처리(C-06) → 리포트에 집계. 없거나 실패해도 리포트로 이동.
          const id = localStorage.getItem('active_trip_id')
          const done = () => {
            localStorage.removeItem('active_trip_id')
            nav('/report')
          }
          if (id) api.completeTrip(id).then(done).catch(done)
          else nav('/report')
        }}
      >
        이동 종료
      </button>
    </div>
  )
}
