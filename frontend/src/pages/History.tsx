import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import type { TripSummary } from '../types/api'

const STATUS_LABEL: Record<TripSummary['status'], string> = {
  in_progress: '이동중',
  completed: '완료',
  cancelled: '취소',
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

// SC-13 이동 기록 목록 — GET /api/trips
export default function History() {
  const nav = useNavigate()
  const [trips, setTrips] = useState<TripSummary[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.listTrips().then(setTrips).catch(() => setFailed(true))
  }, [])

  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>이동 기록</h1>

      {failed && (
        <EmptyState icon="📡" title="기록을 불러오지 못했어요" hint="네트워크 상태를 확인해주세요."
          actionLabel="다시 시도" onAction={() => location.reload()} />
      )}
      {!failed && !trips && <div className="card skeleton">기록 불러오는 중…</div>}
      {!failed && trips && trips.length === 0 && (
        <EmptyState icon="🚶" title="아직 이동 기록이 없어요" hint="첫 이동을 기록하면 여기에 쌓여요."
          actionLabel="경로 찾기" onAction={() => nav('/')} />
      )}

      {trips && trips.length > 0 && (
        <ul className="trip-list">
          {trips.map((t) => (
            <li key={t.id} className="card trip-item">
              <div className="trip-route">
                <strong>{t.from_name || '출발'}</strong>
                <span className="trip-arrow">→</span>
                <strong>{t.to_name || '도착'}</strong>
              </div>
              <div className="trip-meta">
                <span className="muted">{fmtDate(t.started_at)}</span>
                <span className={'trip-badge trip-badge--' + t.status}>{STATUS_LABEL[t.status]}</span>
              </div>
              <div className="trip-stats">
                <span>🕒 {t.total_minutes}분</span>
                <span>☀️ 야외 {t.outdoor_minutes}분</span>
                <span>부하 {t.exposure_load}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
