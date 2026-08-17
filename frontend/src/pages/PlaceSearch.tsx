import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useRouteQuery } from '../store/route'
import type { Place } from '../types/api'

// SC-04 / B-02 장소 검색 — 카카오 키워드검색, 최근 검색, 출발/도착 선택
export default function PlaceSearch() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const target = params.get('target') === 'from' ? 'from' : 'to'
  const setPlace = useRouteQuery((s) => s.setPlace)
  const addRecent = useRouteQuery((s) => s.addRecent)
  const recent = useRouteQuery((s) => s.recent)

  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [loading, setLoading] = useState(false)
  const loc = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => (loc.current = { lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 4000 },
    )
  }, [])

  // 입력 디바운스 300ms
  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setResults(null)
      return
    }
    setLoading(true)
    const id = setTimeout(() => {
      api
        .searchPlaces(term, loc.current?.lat, loc.current?.lng)
        .then((p) => setResults(p))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  const pick = (p: Place) => {
    setPlace(target, p)
    addRecent(p)
    nav(-1)
  }

  // 출발지: 현재 위치로 바로 설정 (실수로 다른 걸 골라도 복구용)
  const useCurrentLocation = () => {
    const set = (lat: number, lng: number) => {
      setPlace('from', { place_id: 'current', name: '현재 위치', address: '', category: '', lat, lng })
      nav(-1)
    }
    if (loc.current) return set(loc.current.lat, loc.current.lng)
    navigator.geolocation?.getCurrentPosition(
      (p) => set(p.coords.latitude, p.coords.longitude),
      () => {},
      { timeout: 6000, maximumAge: 60000 },
    )
  }

  // 지도에서 선택 → 홈 지도 픽 모드로 이동 (해당 target)
  const pickOnMap = () => nav(`/?pick=${target}`)

  const shown = results ?? (q.trim() ? [] : recent)

  return (
    <div className="page">
      <header className="page-head">
        <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
        <span className="muted">{target === 'from' ? '출발지' : '도착지'} 검색</span>
      </header>
      <input
        className="search"
        placeholder={target === 'from' ? '출발지를 검색하세요' : '도착지를 검색하세요'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />

      <div className="loc-actions">
        {target === 'from' && (
          <button className="current-loc-btn" onClick={useCurrentLocation}>📍 현재 위치로 설정</button>
        )}
        <button className="current-loc-btn" onClick={pickOnMap}>🗺️ 지도에서 선택</button>
      </div>

      {loading && <div className="card skeleton">검색 중…</div>}
      {!loading && results?.length === 0 && <p className="empty">검색 결과가 없어요.</p>}
      {!results && !q.trim() && recent.length > 0 && <h2>최근 검색</h2>}

      {shown.map((p) => (
        <button key={p.place_id} className="card place-item" onClick={() => pick(p)}>
          <div className="place-info">
            <strong>{p.name}</strong>
            <span className="muted">{p.address}</span>
          </div>
          {p.distance_m != null && <span className="place-dist">{p.distance_m}m</span>}
        </button>
      ))}
    </div>
  )
}
