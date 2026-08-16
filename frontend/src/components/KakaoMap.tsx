import { useEffect, useRef } from 'react'
import { loadKakao } from '../lib/kakao'

export interface MapMarker { lat: number; lng: number }

interface Props {
  center: { lat: number; lng: number }
  level?: number
  markers?: MapMarker[]
  polyline?: [number, number][] // [lat, lng][]
  onMapClick?: (lat: number, lng: number) => void
  className?: string
}

export default function KakaoMap({ center, level = 5, markers = [], polyline, onMapClick }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const kakaoRef = useRef<any>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])

  useEffect(() => {
    let cancelled = false
    loadKakao()
      .then((kakao) => {
        if (cancelled || !boxRef.current) return
        kakaoRef.current = kakao
        mapRef.current = new kakao.maps.Map(boxRef.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level,
        })
        if (onMapClick) {
          kakao.maps.event.addListener(mapRef.current, 'click', (e: any) =>
            onMapClick(e.latLng.getLat(), e.latLng.getLng()),
          )
        }
        redraw()
      })
      .catch((e) => console.error(e))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const kakao = kakaoRef.current
    if (kakao && mapRef.current) mapRef.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng))
  }, [center.lat, center.lng])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(redraw, [JSON.stringify(markers), JSON.stringify(polyline)])

  function redraw() {
    const kakao = kakaoRef.current
    const map = mapRef.current
    if (!kakao || !map) return
    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []

    markers.forEach((m) => {
      const mk = new kakao.maps.Marker({ position: new kakao.maps.LatLng(m.lat, m.lng) })
      mk.setMap(map)
      overlaysRef.current.push(mk)
    })

    if (polyline && polyline.length > 1) {
      const path = polyline.map(([la, ln]) => new kakao.maps.LatLng(la, ln))
      const line = new kakao.maps.Polyline({ path, strokeWeight: 5, strokeColor: '#1a7f6b', strokeOpacity: 0.9 })
      line.setMap(map)
      overlaysRef.current.push(line)
      const bounds = new kakao.maps.LatLngBounds()
      path.forEach((p: any) => bounds.extend(p))
      map.setBounds(bounds)
    }
  }

  return <div ref={boxRef} style={{ width: '100%', height: '100%' }} />
}
