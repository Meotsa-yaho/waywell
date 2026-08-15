import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import KakaoMap from '../components/KakaoMap'
import { api } from '../api/client'
import type { Environment } from '../types/api'

const DEFAULT = { lat: 37.2011, lng: 127.0983 } // 동탄역

// SC-03 홈 — 지도 우선 + 오늘의 환경 + 경로 검색 진입
export default function Home() {
  const nav = useNavigate()
  const [center, setCenter] = useState(DEFAULT)
  const [env, setEnv] = useState<Environment | null>(null)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 4000 },
    )
  }, [])

  useEffect(() => {
    api.getEnvironment(center.lat, center.lng).then(setEnv).catch(() => setEnv(null))
  }, [center.lat, center.lng])

  return (
    <div className="home-map">
      <div className="map-fill">
        <KakaoMap center={center} markers={[{ lat: center.lat, lng: center.lng }]} />
      </div>

      <div className="map-overlay">
        {env && (
          <div className="env-chip">
            체감 {env.temperature?.feels_like ?? '-'}° · UV {env.uv?.index ?? '-'} · 미세 {env.air?.pm10_grade ?? '-'}
          </div>
        )}
        <div className="search-card">
          <button className="search-field" onClick={() => nav('/search')}>📍 현재 위치</button>
          <button className="search-field muted-field" onClick={() => nav('/search')}>도착지 입력</button>
          <button className="btn primary" onClick={() => nav('/routes')}>경로 검색</button>
        </div>
      </div>
    </div>
  )
}
