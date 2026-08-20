import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  Navigation,
  Bus,
  Train,
  ChevronLeft,
  Coffee,
  Building2,
  ExternalLink,
  Route as RouteIcon,
  Compass,
} from 'lucide-react'
import { api } from '../api/client'
import type { RouteSegment, Shelter, Shade } from '../types/api'

const FALLBACK = { lat: 37.4979, lng: 127.0276, name: '내 위치 (데모)' } // 위치 실패 시 강남역

interface ActiveRoute {
  from: { lat: number; lng: number; name: string }
  to: { lat: number; lng: number; name: string }
  polyline?: [number, number][]
  path_segments?: { type: 'walk' | 'bus' | 'subway'; coords: [number, number][]; outdoor?: boolean }[]
  segments?: RouteSegment[]
  total_minutes?: number
  exposure_load?: number
  outdoor_minutes?: number
}

interface RouteStopPoint {
  id: string
  name: string
  label: string
  type: 'bus' | 'subway' | 'origin' | 'destination' | 'walk'
  lat: number
  lng: number
  detail?: string
}

const CAT_ICON: Record<string, string> = {
  cafe: '☕',
  convenience: '🏪',
  subway_station: '🚇',
  mart: '🛒',
  other: '📍',
}

const kakaoLink = (name: string, lat: number, lng: number) =>
  `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`

function loadActiveRoute(): ActiveRoute | null {
  try {
    return JSON.parse(localStorage.getItem('active_trip_route') || 'null')
  } catch {
    return null
  }
}

export default function Shelters() {
  const nav = useNavigate()
  const [activeRoute] = useState<ActiveRoute | null>(loadActiveRoute)

  // 조회 기준 모드: 'current' (내 현재 위치) | 'route' (선택한 경로 대기 장소)
  const [mode, setMode] = useState<'current' | 'route'>('current')

  // 내 GPS 위치
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number; name: string } | null>(null)

  // 경로 상의 대기 포인트 목록
  const routeStops = useMemo<RouteStopPoint[]>(() => {
    if (!activeRoute) return []
    const stops: RouteStopPoint[] = []
    const seenNames = new Set<string>()

    // 1. 출발지
    if (activeRoute.from?.lat && activeRoute.from?.lng) {
      stops.push({
        id: 'stop_origin',
        name: activeRoute.from.name || '출발지',
        label: '출발',
        type: 'origin',
        lat: activeRoute.from.lat,
        lng: activeRoute.from.lng,
      })
      seenNames.add(activeRoute.from.name)
    }

    // 2. 경로 세그먼트 내 정류소 및 역 추출
    if (activeRoute.segments && activeRoute.segments.length > 0) {
      activeRoute.segments.forEach((seg, idx) => {
        // 버스 대기 / 승차 정류소
        if (seg.type === 'bus_wait' || seg.type === 'bus') {
          const stopName = seg.station || seg.from?.name || (seg.route_name ? `${seg.route_name}번 승차장` : '버스 정류장')
          const lat = seg.lat ?? seg.from?.lat
          const lng = seg.lng ?? seg.from?.lng

          if (lat && lng && !seenNames.has(stopName)) {
            seenNames.add(stopName)
            stops.push({
              id: `stop_bus_${idx}`,
              name: stopName,
              label: seg.type === 'bus_wait' ? '버스 대기' : '버스 승차',
              type: 'bus',
              lat,
              lng,
              detail: seg.route_name ? `${seg.route_name}번 버스` : undefined,
            })
          }
        }

        // 전철 탑승 / 환승역
        if (seg.type === 'subway' || seg.type === 'subway_wait') {
          const stationName = seg.from?.name || seg.station || (seg.line ? `${seg.line} 승차역` : '지하철역')
          const lat = seg.from?.lat ?? seg.lat
          const lng = seg.from?.lng ?? seg.lng

          if (lat && lng && !seenNames.has(stationName)) {
            seenNames.add(stationName)
            stops.push({
              id: `stop_sub_${idx}`,
              name: stationName,
              label: '지하철 승차/환승',
              type: 'subway',
              lat,
              lng,
              detail: seg.line,
            })
          }
        }
      })
    }

    // 3. 도착지
    if (activeRoute.to?.lat && activeRoute.to?.lng && !seenNames.has(activeRoute.to.name)) {
      stops.push({
        id: 'stop_dest',
        name: activeRoute.to.name || '도착지',
        label: '도착',
        type: 'destination',
        lat: activeRoute.to.lat,
        lng: activeRoute.to.lng,
      })
    }

    return stops
  }, [activeRoute])

  // 선택된 정류소 인덱스
  const [selectedStopIdx, setSelectedStopIdx] = useState(0)

  // API 데이터 상태
  const [list, setList] = useState<Shelter[] | null>(null)
  const [shades, setShades] = useState<Shade[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 초기 위치 가져오기 (GPS)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setMyLoc({ lat: p.coords.latitude, lng: p.coords.longitude, name: '내 현재 위치' })
        },
        () => {
          setMyLoc({ lat: FALLBACK.lat, lng: FALLBACK.lng, name: '내 위치 (기본 좌표)' })
        },
        { timeout: 4000 },
      )
    } else {
      setMyLoc({ lat: FALLBACK.lat, lng: FALLBACK.lng, name: '내 위치 (기본 좌표)' })
    }
  }, [])

  // 현재 활성화된 기준 좌표 계산
  const targetPoint = useMemo(() => {
    if (mode === 'route') {
      const stop = routeStops[selectedStopIdx]
      if (stop) return { lat: stop.lat, lng: stop.lng, name: stop.name, detail: stop.label }
    }
    return myLoc ?? FALLBACK
  }, [mode, routeStops, selectedStopIdx, myLoc])

  // 좌표 변경 시 실내 대기 장소 + 야외 그늘막 API 호출
  useEffect(() => {
    if (!targetPoint.lat || !targetPoint.lng) return

    setLoading(true)
    setError(false)

    const p1 = api.getShelters(targetPoint.lat, targetPoint.lng).then(setList).catch(() => setError(true))
    const p2 = api.getShades(targetPoint.lat, targetPoint.lng, 800).then(setShades).catch(() => setShades([]))

    Promise.allSettled([p1, p2]).finally(() => {
      setLoading(false)
    })
  }, [targetPoint.lat, targetPoint.lng])

  const getStopIcon = (type: RouteStopPoint['type']) => {
    switch (type) {
      case 'bus':
        return <Bus className="w-3.5 h-3.5" />
      case 'subway':
        return <Train className="w-3.5 h-3.5" />
      case 'origin':
      case 'destination':
        return <MapPin className="w-3.5 h-3.5" />
      default:
        return <Navigation className="w-3.5 h-3.5" />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav(-1)}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold tracking-tight">근처 대기 장소</h1>
        </div>
        <button
          onClick={() => nav(-1)}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
        >
          닫기
        </button>
      </header>

      {/* 위치 기준 선택 세그먼트 컨트롤 */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-xl flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('current')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'current'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            내 현재 위치 기준
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('route')
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === 'route'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5" />
            선택한 경로 대기장소
            {routeStops.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                {routeStops.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 경로 모드일 때: 경로 내 정류소 / 대기 포인트 칩 리스트 */}
      {mode === 'route' && (
        <div className="px-4 py-2 border-b border-slate-200/60 dark:border-slate-800/60">
          {routeStops.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-emerald-500" />
                  경로 상 정류소·대기 장소 선택
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedStopIdx + 1} / {routeStops.length}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {routeStops.map((stop, idx) => {
                  const isSelected = selectedStopIdx === idx
                  return (
                    <button
                      key={stop.id}
                      onClick={() => setSelectedStopIdx(idx)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                        isSelected
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700'
                      }`}
                    >
                      <span className={isSelected ? 'text-white' : 'text-emerald-500'}>
                        {getStopIcon(stop.type)}
                      </span>
                      <span>{stop.name}</span>
                      <span
                        className={`text-[11px] px-1 py-0.2 rounded ${
                          isSelected
                            ? 'bg-emerald-600/60 text-emerald-100'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {stop.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-200">
              <p className="font-bold">선택된 경로 정보가 없어요.</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-0.5">
                메인 화면에서 출발지와 목적지를 검색하여 경로를 선택하면, 경로 상의 각 정류소 주변 대기 장소를 볼 수 있어요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 현재 기준 장소 정보 배너 */}
      <div className="px-4 py-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  {mode === 'current' ? '내 위치 기준' : '정류소 기준 대기'}
                </span>
              </div>
              <strong className="text-sm font-bold text-slate-800 dark:text-slate-100 block truncate">
                {targetPoint.name}
              </strong>
            </div>
          </div>
          <a
            href={kakaoLink(targetPoint.name, targetPoint.lat, targetPoint.lng)}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-0.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            지도 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 대기 장소 리스트 영역 */}
      <div className="flex-1 px-4 pb-8 space-y-6">
        {/* 실내 대기 장소 섹션 */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-500" />
              실내 대기 장소
              <span className="text-[11px] font-normal text-slate-400">(카페·편의점·지하철역)</span>
            </h2>
            {list && list.length > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {list.length}곳
              </span>
            )}
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="w-2/3 h-3 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="w-2/3 h-3 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                주변 대기 장소를 불러오지 못했어요.
              </p>
              <p className="text-xs text-slate-400 mt-1">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
            </div>
          )}

          {!loading && !error && list && list.length === 0 && (
            <div className="p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Coffee className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                반경 400m 내에 대기할 만한 실내 장소가 없어요.
              </p>
              <p className="text-xs text-slate-400 mt-1">야외 그늘막이나 인근 다른 장소를 확인해 보세요.</p>
            </div>
          )}

          {!loading && list && list.length > 0 && (
            <div className="space-y-2">
              {list.map((s) => (
                <a
                  key={s.place_id}
                  href={s.map_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3.5 p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 active:scale-[0.99] border border-slate-200/80 dark:border-slate-800 rounded-2xl transition-all shadow-sm group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                    {CAT_ICON[s.category] ?? '📍'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <strong className="text-sm font-bold text-slate-800 dark:text-slate-100 block truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {s.name}
                    </strong>
                    <span className="text-xs text-slate-400 block truncate mt-0.5">
                      {s.address}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <strong className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                      도보 {s.walk_minutes}분
                    </strong>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {s.distance_m}m
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 야외 그늘막 섹션 */}
        {!loading && shades && shades.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="text-base">🌂</span>
                야외 그늘막 쉼터
                <span className="text-[11px] font-normal text-slate-400">(햇빛 피하기)</span>
              </h2>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                {shades.length}곳
              </span>
            </div>

            <div className="space-y-2">
              {shades.map((s, i) => (
                <a
                  key={`${s.lat},${s.lng},${i}`}
                  href={kakaoLink(s.name, s.lat, s.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3.5 p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 active:scale-[0.99] border border-slate-200/80 dark:border-slate-800 rounded-2xl transition-all shadow-sm group"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                    🌂
                  </div>
                  <div className="flex-1 min-w-0">
                    <strong className="text-sm font-bold text-slate-800 dark:text-slate-100 block truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {s.name}
                    </strong>
                    <span className="text-xs text-slate-400 block truncate mt-0.5">
                      {s.address || s.type || '야외 그늘막'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <strong className="text-xs font-bold text-amber-600 dark:text-amber-400 block">
                      도보 {s.walk_minutes}분
                    </strong>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {s.distance_m}m
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
