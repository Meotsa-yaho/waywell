import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Shelter } from '../types/api'

const FALLBACK = { lat: 37.4979, lng: 127.0276 } // 강남역 (위치 거부 시 데모 좌표)

const CAT_ICON: Record<string, string> = {
  cafe: '☕',
  convenience: '🏪',
  subway_station: '🚇',
  mart: '🛒',
  other: '📍',
}

// C-04 / SC-08 실내 대기 장소 — 카카오 로컬 반경검색, 도보 가까운 순
export default function Shelters() {
  const nav = useNavigate()
  const [list, setList] = useState<Shelter[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = (lat: number, lng: number) =>
      api.getShelters(lat, lng).then(setList).catch(() => setError(true))
    navigator.geolocation?.getCurrentPosition(
      (p) => load(p.coords.latitude, p.coords.longitude),
      () => load(FALLBACK.lat, FALLBACK.lng),
      { timeout: 4000 },
    ) ?? load(FALLBACK.lat, FALLBACK.lng)
  }, [])

  return (
    <div className="page shelter-page">
      <header className="page-head">
        <h1>실내 대기 장소</h1>
        <button className="link" onClick={() => nav(-1)}>닫기</button>
      </header>
      <p className="muted">더울 땐 근처 실내에서 잠깐 대기하세요 · 가까운 순</p>

      {error && <p className="empty">주변 장소를 불러오지 못했어요.</p>}
      {!error && !list && <div className="card skeleton">주변 장소 찾는 중…</div>}
      {!error && list && list.length === 0 && <p className="empty">근처에 대기할 만한 곳이 없어요.</p>}

      {list?.map((s) => (
        <a key={s.place_id} className="card shelter-item" href={s.map_url} target="_blank" rel="noreferrer">
          <span className="shelter-icon">{CAT_ICON[s.category] ?? '📍'}</span>
          <div className="shelter-info">
            <strong>{s.name}</strong>
            <span className="muted">{s.address}</span>
          </div>
          <div className="shelter-dist">
            <strong>도보 {s.walk_minutes}분</strong>
            <span className="muted">{s.distance_m}m</span>
          </div>
        </a>
      ))}
    </div>
  )
}
