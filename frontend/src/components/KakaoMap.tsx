import { useEffect, useRef } from 'react'
import { loadKakao } from '../lib/kakao'

export interface MapMarker { lat: number; lng: number }
export interface PathSeg { type: 'walk' | 'bus' | 'subway'; coords: [number, number][]; outdoor?: boolean }

// 모드별 색상: 전철=초록, 버스=파랑, 실외도보=주황(점선), 실내도보=회색(점선)
function segStyle(seg: PathSeg): { color: string; style: string; weight: number } {
  if (seg.type === 'subway') return { color: '#1a7f6b', style: 'solid', weight: 6 }
  if (seg.type === 'bus') return { color: '#2b7fff', style: 'solid', weight: 6 }
  return seg.outdoor
    ? { color: '#f08a24', style: 'shortdash', weight: 5 } // 실외 도보 = 주황
    : { color: '#8a938f', style: 'shortdash', weight: 5 } // 실내 도보 = 회색
}

interface Props {
  center: { lat: number; lng: number }
  level?: number
  markers?: MapMarker[]
  polyline?: [number, number][] // [lat, lng][] — 단색 폴백
  paths?: PathSeg[] // 모드별 색상 구분
  fitBottomPadding?: number // 하단 시트에 가리지 않도록 bounds 아래 여백(px)
  recenterKey?: number // 값이 바뀌면 center로 지도 이동(좌표 동일해도 강제) — 현위치 버튼용
  onMapClick?: (lat: number, lng: number) => void
  className?: string
}

export default function KakaoMap({ center, level = 5, markers = [], polyline, paths, fitBottomPadding = 180, recenterKey, onMapClick }: Props) {
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

  // 현위치 버튼: 좌표가 같아도 center로 강제 이동 (확대 변경 없음)
  useEffect(() => {
    const kakao = kakaoRef.current
    if (recenterKey === undefined || !kakao || !mapRef.current) return
    mapRef.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  // 마커나 경로가 실제로 변경될 때만 redraw 실행 (fitBottomPadding 변경으로 인한 지도 흔들림 방지)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(redraw, [JSON.stringify(markers ?? null), JSON.stringify(polyline ?? null), JSON.stringify(paths ?? null)])

  function redraw() {
    const kakao = kakaoRef.current
    const map = mapRef.current
    if (!kakao || !map) return
    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    const bounds = new kakao.maps.LatLngBounds()
    let hasBounds = false

    markers.forEach((m) => {
      const mk = new kakao.maps.Marker({ position: new kakao.maps.LatLng(m.lat, m.lng) })
      mk.setMap(map)
      overlaysRef.current.push(mk)
    })

    // 모드별 색상 경로 (있으면 우선), 없으면 단색 폴백
    if (paths && paths.length) {
      for (const seg of paths) {
        if (seg.coords.length < 2) continue
        const path = seg.coords.map(([la, ln]) => new kakao.maps.LatLng(la, ln))
        const { color, style, weight } = segStyle(seg)
        const line = new kakao.maps.Polyline({ path, strokeWeight: weight, strokeColor: color, strokeOpacity: 0.9, strokeStyle: style })
        line.setMap(map)
        overlaysRef.current.push(line)
        path.forEach((p: any) => { bounds.extend(p); hasBounds = true })
      }
    } else if (polyline && polyline.length > 1) {
      const path = polyline.map(([la, ln]) => new kakao.maps.LatLng(la, ln))
      const line = new kakao.maps.Polyline({ path, strokeWeight: 5, strokeColor: '#1a7f6b', strokeOpacity: 0.9 })
      line.setMap(map)
      overlaysRef.current.push(line)
      path.forEach((p: any) => { bounds.extend(p); hasBounds = true })
    }

    // 경로 전체가 한눈에 보이게 여백 두고 맞춤 (경로가 변경되었을 때만 1회 호출)
    if (hasBounds) map.setBounds(bounds, 40, 40, 40 + fitBottomPadding, 40)
  }

  return <div ref={boxRef} style={{ width: '100%', height: '100%' }} />
}
