import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Navigation, LocateFixed, Flame, Bus, MapPin, Bell, ChevronDown, ChevronUp, Building2,
} from 'lucide-react'
import KakaoMap from '../components/KakaoMap'
import { api } from '../api/client'
import type { Arrival, RouteSegment, Shade } from '../types/api'

type NotifPerm = NotificationPermission | 'unsupported'
const initNotifPerm = (): NotifPerm =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission

// 데모 정류소 — TAGO 실시간 도착이 나오는 세종 송강전통시장 (데모 경로가 지하철이면 버스 노드가 없음)
const DEMO_STATION = 'DJB8001793'
const DEMO_CITY = '25'
const POLL_MS = 30_000
const FALLBACK = { lat: 37.4979, lng: 127.0276 } // 강남역

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

function loadActiveRoute(): ActiveRoute | null {
  try {
    return JSON.parse(localStorage.getItem('active_trip_route') || 'null')
  } catch {
    return null
  }
}

// SC-07 이동 중 — 전체화면 지도(경로 + 실시간 내 위치 팔로우) + 하단 시트(도착정보·노출·쉼터)
export default function Trip() {
  const nav = useNavigate()
  const [data, setData] = useState<Arrival | null>(null)
  const [error, setError] = useState(false)
  const [notifPerm, setNotifPerm] = useState<NotifPerm>(initNotifPerm)
  const [waitedMin, setWaitedMin] = useState(0) // C-03 야외 대기 누적(분)
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [follow, setFollow] = useState(true) // 내 위치 따라가기 (지도 앱처럼)
  const [shades, setShades] = useState<Shade[]>([]) // 근처 야외 그늘막
  const shadeAnchorRef = useRef<{ lat: number; lng: number } | null>(null)
  const [open, setOpen] = useState(true) // 하단 시트 펼침 여부
  const [containerH, setContainerH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 720))
  const [dragH, setDragH] = useState<number | null>(null) // 드래그 중 실시간 높이 (놓으면 null)
  const [snaps, setSnaps] = useState({ collapsed: 110, expanded: 400 }) // 측정된 스냅 높이
  const startRef = useRef({ y: 0, h: 0, active: false }) // active는 ref로(같은 틱 pointerdown/up에도 동기)
  const sheetRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null) // 상세 내용의 자연 높이(flex 늘어남 영향 없음)
  const notifiedFor = useRef<number | null>(null)
  const startedRef = useRef(Date.now())
  const routeRef = useRef<ActiveRoute | null>(loadActiveRoute())
  const route = routeRef.current

  // 다크모드 동기화 (설정 변경 시)

  // 뷰포트 높이 추적 → 시트 스냅 높이 갱신
  useEffect(() => {
    const on = () => setContainerH(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // 스냅 높이 측정: 닫힘=요약 한 줄 하단, 열림=내용 전체(뷰포트 88% 상한). 내용 바뀌면 재측정.
  useLayoutEffect(() => {
    const summary = summaryRef.current
    if (!summary) return
    const collapsed = summary.offsetTop + summary.offsetHeight
    const full = collapsed + (contentRef.current?.offsetHeight ?? 0)
    // 자연스럽게 내용에 맞추되 화면 절반은 넘지 않게 (넘으면 상세가 그 안에서 스크롤)
    setSnaps({ collapsed, expanded: Math.min(full, Math.round(containerH * 0.5)) })
  }, [containerH, data, notifPerm, route])

  // 도착정보 폴링 (C-02) + 야외 대기 누적 타이머
  useEffect(() => {
    let alive = true
    const tick = () => alive && setWaitedMin(Math.floor((Date.now() - startedRef.current) / 60000))
    const load = () =>
      api.getArrival(DEMO_STATION, undefined, DEMO_CITY)
        .then((d) => alive && (setData(d), setError(false)))
        .catch(() => alive && setError(true))
    load()
    tick()
    const id = setInterval(() => { load(); tick() }, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // 실시간 내 위치 구독 (watchPosition) — 지도 마커 팔로우
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (p) => setMyLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { /* 권한 거부/실패 시 마커 없이 진행 */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // 근처 야외 그늘막: 위치가 ~220m 이상 바뀔 때만 재조회 (로컬 저장분이라 가벼움)
  useEffect(() => {
    const loc = myLoc ?? route?.from ?? FALLBACK
    const prev = shadeAnchorRef.current
    if (prev && Math.abs(prev.lat - loc.lat) < 0.002 && Math.abs(prev.lng - loc.lng) < 0.002) return
    shadeAnchorRef.current = loc
    api.getShades(loc.lat, loc.lng, 800).then(setShades).catch(() => { })
  }, [myLoc, route])

  const next = data?.arrivals[0]
  const soon = next && next.minutes <= 3 // 실내 대기 알림 임계 (3분 전)
  const longWait = next && next.minutes >= 10 // 10분 이상 → 야외 노출 경고

  // C-05 도착 3분 전 알림: soon 진입 시 차량당 1회
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

  const endTrip = () => {
    const id = localStorage.getItem('active_trip_id')
    const done = () => {
      localStorage.removeItem('active_trip_id')
      localStorage.removeItem('active_trip_route')
      nav('/report')
    }
    if (id) api.completeTrip(id).then(done).catch(done)
    else done()
  }

  const mapCenter = route?.from ?? myLoc ?? FALLBACK
  const markers = route ? [route.from, route.to] : []

  const card = 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100'
  const chip = 'bg-white/90 border-slate-200 text-slate-700 dark:bg-slate-900/90 dark:border-slate-700 dark:text-slate-200'

  // 하단 시트: 높이는 CSS 트랜지션으로 스냅. 드래그 중엔 dragH로 실시간 추종(트랜지션 off).
  // 네이티브 pointer 이벤트로 드래그(마우스/터치) + 탭 토글.
  const baseH = open ? snaps.expanded : snaps.collapsed
  const sheetH = dragH ?? baseH
  const onHandleDown = (e: RPointerEvent) => {
    startRef.current = { y: e.clientY, h: baseH, active: true }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 포인터 캡처 미지원/합성 이벤트 */ }
  }
  const onHandleMove = (e: RPointerEvent) => {
    if (!startRef.current.active) return
    setDragH(Math.max(snaps.collapsed - 20, Math.min(snaps.expanded + 20, startRef.current.h + (startRef.current.y - e.clientY))))
  }
  const onHandleUp = (e: RPointerEvent) => {
    if (!startRef.current.active) return
    startRef.current.active = false
    const cur = startRef.current.h + (startRef.current.y - e.clientY) // pointerup 시점 실시간 높이
    const moved = Math.abs(e.clientY - startRef.current.y)
    if (moved < 6) setOpen((o) => !o) // 탭 = 토글
    else setOpen(cur > (snaps.collapsed + snaps.expanded) / 2) // 드래그 = 가까운 쪽으로 스냅
    setDragH(null)
  }

  return (
    <div className={`relative w-full h-[100dvh] overflow-hidden select-none bg-slate-100 dark:bg-slate-950`}>
      {/* 전체화면 지도: 경로 + 실시간 내 위치(팔로우) */}
      <div className="absolute inset-0 z-0">
        <KakaoMap
          center={mapCenter}
          markers={markers}
          paths={route?.path_segments}
          polyline={route?.polyline}
          myLocation={myLoc}
          follow={follow}
          onUserDrag={() => setFollow(false)}
          shades={shades}
          fitBottomPadding={280}
        />
      </div>

      {/* 상단: 이동 중 배지 + 팔로우 토글 */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center justify-between pointer-events-none">
        <span className={`pointer-events-auto flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full shadow-md backdrop-blur-md border ${chip}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          실시간 이동 중
        </span>
        <button
          onClick={() => setFollow((f) => !f)}
          className={`pointer-events-auto flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full shadow-md backdrop-blur-md border transition-colors active:scale-95 ${
            follow
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : chip
          }`}
        >
          <LocateFixed className="w-3.5 h-3.5" />
          {follow ? '따라가는 중' : '내 위치'}
        </button>
      </div>

      {/* 하단 시트: 드래그(또는 탭)로 접었다 폈다. 도착 타이머는 접어도 보임 */}
      <div
        ref={sheetRef}
        style={{ height: sheetH }}
        className={`absolute left-0 right-0 bottom-[64px] z-30 rounded-t-3xl border-t shadow-2xl flex flex-col overflow-hidden ${dragH == null ? 'transition-[height] duration-300 ease-out' : ''} ${card}`}
      >
        {/* Handle — 드래그(마우스/터치)로 열고 닫기, 탭으로 토글 */}
        <div
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          className="w-full pt-2.5 pb-1.5 flex flex-col items-center gap-1 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <span className={`w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700`} />
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </div>

        {/* 항상 보이는 요약: 다음 차량까지 (닫힘 상태에서 이 줄까지만 보임) */}
        <div ref={summaryRef} className="px-4 pb-3 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] text-slate-400 block">다음 차량까지</span>
            {error && !data ? (
              <strong className="text-lg font-semibold text-slate-400">정보 없음</strong>
            ) : !data ? (
              <strong className="text-lg font-semibold text-slate-400">불러오는 중…</strong>
            ) : next ? (
              <div className="flex items-baseline gap-2">
                <strong className={`text-2xl font-semibold ${soon ? 'text-emerald-500' : longWait ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {next.minutes}분
                </strong>
                <span className="text-xs font-semibold text-slate-500">
                  {data.route_name}번 · {next.stations_left ?? '-'}정류장 전{soon && ' · 곧 도착!'}
                </span>
              </div>
            ) : (
              <strong className="text-lg font-semibold text-slate-400">{data.notice ?? '도착 예정 없음'}</strong>
            )}
          </div>
          {/* 야외 대기 누적 */}
          <div className="text-right shrink-0">
            <span className="text-[11px] text-slate-400 block">🌡️ 야외 대기</span>
            <strong className={`text-lg font-semibold ${waitedMin >= 10 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
              {waitedMin}분
            </strong>
          </div>
        </div>

        {/* 상세 — 시트를 펴면 보임(접으면 시트 높이로 가려짐). 스크롤 컨테이너 + 자연높이 내부 wrapper */}
        <div className="flex-1 overflow-y-auto border-t border-slate-100 dark:border-slate-800">
        <div ref={contentRef} className="px-4 pb-4 pt-3 space-y-2.5">
            {/* 알림 CTA / 안내 */}
            {notifPerm === 'default' && (
              <button
                onClick={enableNotif}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
              >
                <Bell className="w-3.5 h-3.5" /> 도착 3분 전 알림 받기
              </button>
            )}
            {notifPerm === 'denied' && (
              <p className="text-[11px] text-slate-400">🔕 알림이 꺼져 있어요. 브라우저 설정에서 허용하면 도착 알림을 받아요.</p>
            )}

            {/* 긴 대기 경고 → 쉼터 */}
            {longWait && (
              <button
                onClick={() => nav('/trip/shelters')}
                className="w-full flex items-center gap-2 p-3 rounded-xl text-xs font-bold text-left bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
              >
                <Flame className="w-4 h-4 shrink-0" />
                <span>다음 차량까지 {next!.minutes}분 · 야외 대기가 길어요. 실내 대기 장소로 이동하세요 →</span>
              </button>
            )}

            {/* 다음 차량들 */}
            {data && data.arrivals.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400">다음 차량</span>
                {data.arrivals.slice(1, 4).map((a) => (
                  <div key={a.seq} className={`flex items-center justify-between p-2.5 rounded-xl border text-xs border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40`}>
                    <span className="flex items-center gap-1.5 font-bold">
                      <Bus className="w-3.5 h-3.5 text-emerald-500" />{a.route_name}번
                    </span>
                    <span className="text-slate-500">{a.minutes}분 · {a.stations_left ?? '-'}정류장 전</span>
                  </div>
                ))}
              </div>
            )}

            {/* 목적지 */}
            {route && (
              <div className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40`}>
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="font-bold truncate">{route.to.name}</span>
                {route.total_minutes != null && <span className="text-slate-400 ml-auto shrink-0">약 {route.total_minutes}분</span>}
              </div>
            )}

            <button
              onClick={() => nav('/trip/shelters')}
              className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
            >
              <Building2 className="w-3.5 h-3.5" /> 근처 그늘막·실내 대기 장소
              {shades.length > 0 && <span className="text-[11px] font-bold text-amber-500">🌂 {shades.length}</span>}
            </button>

            <p className="text-[11px] text-slate-400 text-center">30초마다 갱신 · 실시간(TAGO)</p>
        </div>
        </div>
      </div>

      {/* 하단 고정: 이동 종료 */}
      <div className={`absolute bottom-0 left-0 right-0 z-40 h-16 px-3 flex items-center border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900`}>
        <button
          onClick={endTrip}
          className="w-full py-3 bg-slate-800 dark:bg-slate-700 hover:opacity-90 active:scale-[0.99] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
        >
          <Navigation className="w-4 h-4" /> 이동 종료
        </button>
      </div>
    </div>
  )
}
