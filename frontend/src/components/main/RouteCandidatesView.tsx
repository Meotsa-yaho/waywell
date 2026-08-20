import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, animate, type PanInfo } from 'motion/react';
import {
  ArrowLeft,
  AlertTriangle,
  Bus,
  Train,
  Footprints,
  Navigation,
  Sparkles,
  RefreshCw,
  ArrowUpDown,
  Building,
  Clock,
  Crosshair,
  X,
  Sun,
  Flame,
} from 'lucide-react';
import KakaoMap from '../KakaoMap';
import { api } from '../../api/client';
import { withLlmComments } from '../../lib/explain';
import { useRouteQuery } from '../../store/route';
import { useSession } from '../../store/session';
import type { Route, RouteSegment, Place } from '../../types/api';

interface RouteCandidatesViewProps {
  originName: string;
  destinationName: string;
  onBackToSearch: () => void;
  onShowToast: (msg: string) => void;
}

type SheetSnapState = 'collapsed' | 'half' | 'expanded';

const gradeLabel: Record<string, string> = {
  precise: '정밀 예측',
  realtime: '실시간',
  estimated: '추정',
};

// 점수만 보여주면 42점이 좋은 건지 알 수 없다. 단계 라벨을 같이 준다.
function exposureLevel(score: number) {
  if (score <= 20) return { label: '노출 적음', tone: 'text-[var(--ok)]' };
  if (score <= 45) return { label: '노출 보통', tone: 'text-[var(--ink-soft)]' };
  if (score <= 70) return { label: '노출 많음', tone: 'text-[var(--warn)]' };
  return { label: '노출 심함', tone: 'text-[var(--danger)]' };
}

export const RouteCandidatesView: React.FC<RouteCandidatesViewProps> = ({
  originName: initialOriginName,
  destinationName: initialDestName,
  onBackToSearch,
  onShowToast,
}) => {
  const nav = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0); // 경로 요청 순서 가드 (오래된 응답/실패 무시)
  const fromPlace = useRouteQuery((s) => s.from);
  const toPlace = useRouteQuery((s) => s.to);
  const setPlace = useRouteQuery((s) => s.setPlace);
  const addRecent = useRouteQuery((s) => s.addRecent);
  const isDemoActive = useRouteQuery((s) => s.isDemoActive);
  const weather = useRouteQuery((s) => s.weather);
  const setWeather = useRouteQuery((s) => s.setWeather);
  const exitDemoSession = useRouteQuery((s) => s.exitDemoSession);
  const preset = useSession((s) => s.preset);

  // Editable origin and destination states
  const [origin, setOrigin] = useState(initialOriginName);
  const [destination, setDestination] = useState(initialDestName);

  // Suggestions state
  const [originSuggestions, setOriginSuggestions] = useState<Place[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [originFocused, setOriginFocused] = useState(false); // 포커스 시 '현재 위치' 옵션 노출
  const [destSuggestions, setDestSuggestions] = useState<Place[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 3-Stage Snap Heights in Pixels
  const [snapState, setSnapState] = useState<SheetSnapState>('half');
  const [containerH, setContainerH] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerHeight - 58 : 640;
  });

  const snapPoints = useMemo(() => {
    const h = containerH;
    return {
      collapsed: 88, // 최소화 시 핸들+시간 요약 헤더만 (구간 상세는 숨김). '안내 시작'은 시트 밖 하단 고정
      half: Math.round(h * 0.50),
      expanded: Math.round(h * 0.82),
    };
  }, [containerH]);

  const heightMV = useMotionValue(snapPoints.half);
  const startDragHeightRef = useRef<number>(snapPoints.half);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerH(containerRef.current.clientHeight);
      } else if (typeof window !== 'undefined') {
        setContainerH(window.innerHeight - 58);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Update sheet position when snapPoints or snapState changes
  useEffect(() => {
    const targetH = snapPoints[snapState];
    animate(heightMV, targetH, { type: 'spring', damping: 26, stiffness: 320 });
  }, [snapState, snapPoints, heightMV]);

  const fromLat = fromPlace?.lat ?? 37.2011;
  const fromLng = fromPlace?.lng ?? 127.0983;
  const toLat = toPlace?.lat ?? 37.4979;
  const toLng = toPlace?.lng ?? 127.0276;

  const fetchRoutes = (fromCoord: string, toCoord: string, fromName: string, toName: string, targetWeather = weather) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    api.getRoutes({
      from: fromCoord,
      to: toCoord,
      from_name: fromName,
      to_name: toName,
      geometry: '1',
      preset,
      demo_weather: isDemoActive ? (targetWeather === 'uv_high' ? 'uv_high' : 'clear') : undefined,
    })
      .then((res) => {
        if (reqId !== reqIdRef.current) return; // 오래된 응답 무시
        if (res.routes && res.routes.length > 0) {
          setRoutes(res.routes);
          const recRoute = res.routes.find((r) => r.recommended) || res.routes[0];
          setSelectedRouteId(recRoute.route_id);
          // B-09 코멘트는 뒤늦게 채운다 — 카드 표시를 LLM 지연으로 붙잡지 않기 위해
          withLlmComments(res).then((withComments) => {
            if (reqId !== reqIdRef.current) return; // 그 사이 다른 조회가 시작됐으면 버림
            setRoutes(withComments);
          });
        } else {
          setError('해당 구간의 대중교통 경로를 찾지 못했습니다.');
        }
      })
      .catch(() => {
        if (reqId !== reqIdRef.current) return; // 오래된/취소된 요청의 실패는 무시 (좋은 결과 유지)
        setError('경로를 불러오는 중 오류가 발생했습니다.');
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false);
      });
  };

  useEffect(() => {
    const fromParam = `${fromLat},${fromLng}`;
    const toParam = `${toLat},${toLng}`;
    fetchRoutes(fromParam, toParam, origin, destination, weather);
  }, [fromLat, fromLng, toLat, toLng, preset, weather, isDemoActive]);

  // Debounced Place Search for Origin
  useEffect(() => {
    const term = origin.trim();
    if (!term || term === fromPlace?.name) {
      setOriginSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingOrigin(true);
      api.searchPlaces(term, fromLat, fromLng)
        .then((places) => setOriginSuggestions(places.slice(0, 5)))
        .catch(() => setOriginSuggestions([]))
        .finally(() => setIsSearchingOrigin(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [origin, fromLat, fromLng, fromPlace?.name]);

  // Debounced Place Search for Destination
  useEffect(() => {
    const term = destination.trim();
    if (!term || term === toPlace?.name) {
      setDestSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingDest(true);
      api.searchPlaces(term, fromLat, fromLng)
        .then((places) => setDestSuggestions(places.slice(0, 5)))
        .catch(() => setDestSuggestions([]))
        .finally(() => setIsSearchingDest(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [destination, fromLat, fromLng, toPlace?.name]);

  const handleSelectOrigin = (place: Place) => {
    setOrigin(place.name);
    setPlace('from', place);
    addRecent(place);
    setOriginSuggestions([]);
    setOriginFocused(false);
    const fromParam = `${place.lat},${place.lng}`;
    const toParam = `${toLat},${toLng}`;
    fetchRoutes(fromParam, toParam, place.name, destination);
    onShowToast(`출발지를 '${place.name}'(으)로 변경했습니다.`);
  };

  // 출발지 드롭다운의 '현재 위치로 설정' — GPS 좌표로 출발지 지정 후 재탐색
  const handleUseCurrentLocation = () => {
    setOriginSuggestions([]);
    setOriginFocused(false);
    if (!navigator.geolocation) {
      onShowToast('이 기기에서는 현재 위치를 쓸 수 없어요.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const place: Place = {
          place_id: 'current', name: '현재 위치', address: '현재 위치', category: '',
          lat: p.coords.latitude, lng: p.coords.longitude,
        };
        setOrigin('현재 위치');
        setPlace('from', place);
        fetchRoutes(`${place.lat},${place.lng}`, `${toLat},${toLng}`, '현재 위치', destination);
        onShowToast('출발지를 현재 위치로 설정했습니다.');
      },
      () => onShowToast('현재 위치를 가져오지 못했어요.'),
      { timeout: 5000, maximumAge: 60000 },
    );
  };

  const handleSelectDest = (place: Place) => {
    setDestination(place.name);
    setPlace('to', place);
    addRecent(place);
    setDestSuggestions([]);
    const fromParam = `${fromLat},${fromLng}`;
    const toParam = `${place.lat},${place.lng}`;
    fetchRoutes(fromParam, toParam, origin, place.name);
    onShowToast(`도착지를 '${place.name}'(으)로 변경했습니다.`);
  };

  const handleSwap = () => {
    const tempOrigin = origin;
    const tempDest = destination;
    setOrigin(tempDest);
    setDestination(tempOrigin);
    if (fromPlace && toPlace) {
      setPlace('from', toPlace);
      setPlace('to', fromPlace);
      const fromParam = `${toPlace.lat},${toPlace.lng}`;
      const toParam = `${fromPlace.lat},${fromPlace.lng}`;
      fetchRoutes(fromParam, toParam, tempDest, tempOrigin);
    }
    setOriginSuggestions([]);
    setDestSuggestions([]);
    onShowToast('출발지와 도착지를 바꿨습니다.');
  };

  const handleToggleWeather = (target: 'mild' | 'uv_high') => {
    if (weather === target) return;
    setWeather(target);
    if (target === 'uv_high') {
      onShowToast('🔥 폭염·자외선 경보 적용! 실내·지하철 위주 경로가 1순위 추천으로 역전됩니다.');
    } else {
      onShowToast('☀️ 쾌적한 날씨 적용! 최단 시간 이동 경로가 1순위 추천으로 복귀합니다.');
    }
  };

  const handleExitDemo = () => {
    exitDemoSession();
    onShowToast('데모 시연 모드를 종료했습니다.');
  };

  const selectedRoute = useMemo(() => {
    return routes?.find((r) => r.route_id === selectedRouteId) || routes?.[0];
  }, [routes, selectedRouteId]);

  // Click toggle snap between 3 stages
  const toggleSnap = () => {
    if (snapState === 'collapsed') {
      setSnapState('half');
    } else if (snapState === 'half') {
      setSnapState('expanded');
    } else {
      setSnapState('collapsed');
    }
  };

  // Realtime Drag Pan Tracking & Snapping
  const handlePanStart = () => {
    startDragHeightRef.current = heightMV.get();
  };

  const handlePan = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const minH = snapPoints.collapsed - 15;
    const maxH = snapPoints.expanded + 20;
    const newH = Math.max(minH, Math.min(maxH, startDragHeightRef.current - info.offset.y));
    heightMV.set(newH);
  };

  const handlePanEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const currentH = heightMV.get();
    const velocity = info.velocity.y;

    let nextState: SheetSnapState = 'half';

    // Fling / Fast velocity detection
    if (velocity < -280) {
      if (currentH < snapPoints.half) {
        nextState = 'half';
      } else {
        nextState = 'expanded';
      }
    } else if (velocity > 280) {
      if (currentH > snapPoints.half) {
        nextState = 'half';
      } else {
        nextState = 'collapsed';
      }
    } else {
      // Find closest snap point
      const distCollapsed = Math.abs(currentH - snapPoints.collapsed);
      const distHalf = Math.abs(currentH - snapPoints.half);
      const distExpanded = Math.abs(currentH - snapPoints.expanded);

      if (distCollapsed <= distHalf && distCollapsed <= distExpanded) {
        nextState = 'collapsed';
      } else if (distExpanded <= distHalf && distExpanded <= distCollapsed) {
        nextState = 'expanded';
      } else {
        nextState = 'half';
      }
    }

    setSnapState(nextState);
    const targetH = snapPoints[nextState];
    animate(heightMV, targetH, { type: 'spring', damping: 26, stiffness: 320 });
  };

  const handleStartTrip = () => {
    if (!selectedRoute) return;
    // 이동 중(/trip) 지도에 경로·좌표를 그리도록 선택 경로를 stash
    localStorage.setItem('active_trip_route', JSON.stringify({
      from: { lat: fromLat, lng: fromLng, name: origin },
      to: { lat: toLat, lng: toLng, name: destination },
      polyline: selectedRoute.polyline,
      path_segments: selectedRoute.path_segments,
      segments: selectedRoute.segments,
      total_minutes: selectedRoute.total_minutes,
      exposure_load: selectedRoute.exposure_load,
      outdoor_minutes: selectedRoute.outdoor_minutes,
    }));
    api.startTrip({
      from_name: origin,
      to_name: destination,
      total_minutes: selectedRoute.total_minutes,
      exposure_load: selectedRoute.exposure_load,
      outdoor_minutes: selectedRoute.outdoor_minutes,
    })
      .then((t) => localStorage.setItem('active_trip_id', t.trip_id))
      .catch(() => { })
      .finally(() => {
        onShowToast(`'${selectedRoute.total_minutes}분' 실시간 이동 안내를 시작합니다.`);
        nav('/trip');
      });
  };

  const getSegmentIcon = (type: RouteSegment['type'], outdoor?: boolean) => {
    if (type === 'subway' || type === 'subway_wait') {
      return <Train className="w-4 h-4 text-teal-500" />;
    }
    if (type === 'bus' || type === 'bus_wait') {
      return <Bus className="w-4 h-4 text-emerald-500" />;
    }
    return outdoor ? (
      <Footprints className="w-4 h-4 text-amber-500" />
    ) : (
      <Footprints className="w-4 h-4 text-slate-400" />
    );
  };

  // Map markers & paths
  const mapCenter = useMemo(() => {
    if (selectedRoute?.polyline?.[0]) {
      return { lat: selectedRoute.polyline[0][0], lng: selectedRoute.polyline[0][1] };
    }
    return { lat: fromLat, lng: fromLng };
  }, [selectedRoute, fromLat, fromLng]);

  const markers = useMemo(() => [
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng },
  ], [fromLat, fromLng, toLat, toLng]);

  return (
    <div ref={containerRef} className="route-fullscreen relative w-full h-[calc(100dvh-58px)] overflow-hidden select-none">
      {/* 1. Kakao Map Real Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <KakaoMap
          center={mapCenter}
          markers={markers}
          paths={selectedRoute?.path_segments}
          polyline={selectedRoute?.polyline}
          fitBottomPadding={200}
        />
      </div>

      {/* 2. Floating Top Header & Route Inputs (Two-line Editable) */}
      <div className="relative z-20 p-3 sm:p-4 pointer-events-none space-y-2">
        {/* Demo Mode Floating Controller */}
        {isDemoActive && (
          <div className="pointer-events-auto rounded-2xl p-2.5 sm:p-3 border shadow-xl backdrop-blur-md bg-gradient-to-r from-slate-900/95 via-indigo-950/95 to-slate-900/95 border-indigo-500/50 text-white space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span className="text-xs font-semibold text-indigo-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  킬러 장면 시연 모드
                </span>
              </div>
              <button
                type="button"
                onClick={handleExitDemo}
                className="text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                데모 종료
              </button>
            </div>

            <p className="text-[11px] text-slate-300">
              날씨를 변경하면 동일한 구간에서 <strong className="text-amber-300 font-bold">1위 추천 경로</strong>가 실시간으로 교체됩니다.
            </p>

            {/* Weather Toggle Buttons */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => handleToggleWeather('mild')}
                className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  weather === 'mild'
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sun className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">☀️ 쾌적 (최속 우선)</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleWeather('uv_high')}
                className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  weather === 'uv_high'
                    ? 'bg-rose-500 text-white shadow-md scale-[1.02]'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">🔥 폭염 (실내·지하철)</span>
              </button>
            </div>
          </div>
        )}

        {/* Back Button & Header Summary */}
        <div className="flex items-center justify-between">
          <button
            id="btn-back-to-search"
            onClick={onBackToSearch}
            className={`pointer-events-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer border bg-white/90 text-slate-700 border-slate-200 hover:bg-white dark:bg-slate-900/90 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>검색 조건 변경</span>
          </button>

          <span className={`pointer-events-auto text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md backdrop-blur-md border text-emerald-800 bg-white/90 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/80 dark:border-emerald-700/60`}>
            신체 부하 경로 분석 완료
          </span>
        </div>

        {/* Two-Line Editable Origin & Destination Card */}
        <div className={`pointer-events-auto rounded-2xl p-2.5 sm:p-3 border shadow-md backdrop-blur-md transition-colors relative z-30 space-y-1.5 bg-white/95 border-slate-200 text-slate-800 dark:bg-slate-900/90 dark:border-slate-700 dark:text-slate-200`}>
          {/* 1. Origin Input */}
          <div className="relative">
            <div className={`flex items-center border rounded-xl px-2.5 py-1.5 transition-all bg-slate-50 border-slate-200 focus-within:border-emerald-500 dark:bg-slate-800/90 dark:border-slate-700 dark:focus-within:border-emerald-500`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shrink-0"></span>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onFocus={() => setOriginFocused(true)}
                onBlur={() => setTimeout(() => setOriginFocused(false), 150)}
                placeholder="출발지 입력"
                className={`w-full bg-transparent text-xs font-bold placeholder-slate-400 focus:outline-none text-slate-800 dark:text-white`}
              />
              {isSearchingOrigin ? (
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0 mr-1" />
              ) : origin ? (
                <button
                  type="button"
                  onClick={() => {
                    setOrigin('');
                    setOriginSuggestions([]);
                  }}
                  className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
            </div>

            {/* Origin Dropdown: 포커스 시 '현재 위치' + 입력 시 검색후보 */}
            <AnimatePresence>
              {(originFocused || originSuggestions.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl z-50 overflow-hidden bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700`}
                >
                  <div className="p-1 space-y-0.5">
                    {/* 현재 위치로 설정 (항상 상단) */}
                    <div
                      onMouseDown={(e) => { e.preventDefault(); handleUseCurrentLocation(); }}
                      className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${originSuggestions.length > 0 ? 'border-b' : ''} hover:bg-emerald-50 text-emerald-700 border-slate-100 dark:hover:bg-slate-800 dark:text-emerald-400 dark:border-slate-800`}
                    >
                      <Crosshair className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-bold">📍 현재 위치로 설정</span>
                    </div>
                    {originSuggestions.map((sug) => (
                      <div
                        key={sug.place_id}
                        onClick={() => handleSelectOrigin(sug)}
                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors hover:bg-emerald-50 text-slate-800 dark:hover:bg-slate-800 dark:text-slate-200`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{sug.name}</span>
                            <span className="block truncate text-[12px] text-[var(--muted)]">{sug.address}</span>
                          </div>
                        </div>
                        {sug.distance_m != null && (
                          <span className="shrink-0 text-[12px] text-[var(--muted)]">{sug.distance_m}m</span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Swap Button */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
            <button
              type="button"
              onClick={handleSwap}
              className={`w-6 h-6 border rounded-full shadow-xs flex items-center justify-center transition-all cursor-pointer bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-emerald-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:text-emerald-400`}
              title="출발지/도착지 변경"
            >
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>

          {/* 2. Destination Input */}
          <div className="relative">
            <div className={`flex items-center border rounded-xl px-2.5 py-1.5 transition-all bg-slate-50 border-slate-200 focus-within:border-emerald-500 dark:bg-slate-800/90 dark:border-slate-700 dark:focus-within:border-emerald-500`}>
              <span className="w-2 h-2 rounded-full bg-rose-500 mr-2 shrink-0"></span>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="도착지 입력"
                className={`w-full bg-transparent text-xs font-bold placeholder-slate-400 focus:outline-none text-slate-800 dark:text-white`}
              />
              {isSearchingDest ? (
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0 mr-1" />
              ) : destination ? (
                <button
                  type="button"
                  onClick={() => {
                    setDestination('');
                    setDestSuggestions([]);
                  }}
                  className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
            </div>

            {/* Destination Dropdown Suggestions */}
            <AnimatePresence>
              {destSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl z-50 overflow-hidden bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700`}
                >
                  <div className="p-1 space-y-0.5">
                    {destSuggestions.map((sug) => (
                      <div
                        key={sug.place_id}
                        onClick={() => handleSelectDest(sug)}
                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors hover:bg-emerald-50 text-slate-800 dark:hover:bg-slate-800 dark:text-slate-200`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{sug.name}</span>
                            <span className="block truncate text-[12px] text-[var(--muted)]">{sug.address}</span>
                          </div>
                        </div>
                        {sug.distance_m != null && (
                          <span className="shrink-0 text-[12px] text-[var(--muted)]">{sug.distance_m}m</span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Route Candidate Switcher Bar */}
        {routes && routes.length > 0 && (
          <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {routes.map((r) => {
              const isSelected = r.route_id === selectedRoute?.route_id;
              return (
                <button
                  key={r.route_id}
                  onClick={() => setSelectedRouteId(r.route_id)}
                  className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[var(--r-md)] border px-3 py-2 text-[13px] backdrop-blur-md transition-colors ${
                    isSelected
                      ? 'border-[var(--brand)] bg-[var(--brand)] font-semibold text-white'
                      : 'border-[var(--line)] bg-[var(--card)]/90 text-[var(--ink-soft)] hover:bg-[var(--card)]'
                  }`}
                >
                  {r.recommended && (
                    <span className={`rounded-[var(--r-sm)] px-1.5 py-0.5 text-[11px] font-semibold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[var(--brand-tint)] text-[var(--brand-ink)]'
                    }`}>
                      추천
                    </span>
                  )}
                  {r.route_type === 'walk' && (
                    <span className={`flex items-center gap-0.5 rounded-[var(--r-sm)] px-1.5 py-0.5 text-[11px] font-semibold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[var(--warn-tint)] text-[var(--warn)]'
                    }`}>
                      <Footprints className="h-3 w-3" />도보
                    </span>
                  )}
                  <span className="font-semibold">{r.total_minutes}분</span>
                  <span className={`text-[12px] ${isSelected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                    야외 {r.outdoor_minutes}분
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-xs">
          <div className={`p-4 rounded-2xl border shadow-xl flex items-center gap-2.5 text-xs font-bold bg-white text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-white dark:border-slate-700`}>
            <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
            <span>경로를 찾는 중</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
          <div className={`max-w-xs w-full p-5 rounded-2xl border shadow-xl text-center space-y-3 bg-white text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-white dark:border-slate-700`}>
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-xs font-bold">{error}</p>
            <button
              onClick={onBackToSearch}
              className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              출발지·도착지 다시 설정
            </button>
          </div>
        </div>
      )}

      {/* 3. Interactive Bottom Sheet (Realtime Height tracking + Firm bottom anchor) */}
      {selectedRoute && (
        <motion.div
          id="route-detail-bottom-sheet"
          style={{ height: heightMV }}
          className={`absolute bottom-[72px] left-0 right-0 z-30 rounded-t-3xl border-t shadow-2xl transition-colors duration-200 flex flex-col pointer-events-auto bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`}
        >
          {/* Grab Handle Header with Real-time Pan Gestures */}
          <motion.div
            onPanStart={handlePanStart}
            onPan={handlePan}
            onPanEnd={handlePanEnd}
            onClick={toggleSnap}
            className="w-full pt-3 pb-2.5 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 select-none touch-none"
          >
            <div className={`w-10 h-1.5 rounded-full bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors`} />
          </motion.div>

          {/* Sheet Main Header */}
          <div className="px-4 pb-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {selectedRoute.recommended && (
                  <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[11px] font-semibold text-white">
                    추천
                  </span>
                )}
                <span className="text-[11px] text-[var(--muted)]">
                  {gradeLabel[selectedRoute.prediction_grade] || '실시간'}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[22px] font-semibold leading-none">{selectedRoute.total_minutes}분</span>
                <span className="text-[13px] text-[var(--muted)]">
                  환승 {selectedRoute.transfers}회 · 실내 {Math.round(selectedRoute.indoor_ratio * 100)}%
                </span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <span className={`block text-[15px] font-semibold leading-none ${exposureLevel(selectedRoute.exposure_load).tone}`}>
                {exposureLevel(selectedRoute.exposure_load).label}
              </span>
              <span className="mt-1 block text-[11px] text-[var(--muted)]">
                야외 {selectedRoute.outdoor_minutes}분 · {selectedRoute.exposure_load}점
              </span>
            </div>
          </div>

          {/* Sheet Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* 데모 모드 가상 환경 지표 안내 스트립 */}
            {isDemoActive && (
              <div className="flex items-center justify-between rounded-[var(--r-md)] border border-dashed border-[var(--line-strong)] bg-[var(--bg)] px-3 py-2 text-[12px]">
                <span className="flex items-center gap-1.5 text-[var(--ink-soft)]">
                  {weather === 'uv_high'
                    ? <Flame className="h-3.5 w-3.5 text-[var(--danger)]" />
                    : <Sun className="h-3.5 w-3.5 text-[var(--warn)]" />}
                  데모 날씨
                </span>
                <span className="font-semibold">
                  {weather === 'uv_high' ? 'UV 9 · 체감 35℃' : 'UV 2 · 체감 23℃'}
                </span>
              </div>
            )}

            {/* 출발시각 넛지 배너 — 실시간 버스 대기가 길 때만 */}
            {selectedRoute.depart_nudge && (
              <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold">
                  <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
                  {selectedRoute.depart_nudge.delay_minutes}분 늦게 나가기
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">{selectedRoute.depart_nudge.text}</p>
              </div>
            )}

            {/* LLM Coaching Banner */}
            {selectedRoute.llm_comment && (
              <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--brand-tint)] p-3">
                <p className="flex gap-2 text-[13px] leading-relaxed text-[var(--brand-ink)]">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {selectedRoute.llm_comment}
                </p>
              </div>
            )}

            {/* Timeline Segment Flow */}
            <div className="space-y-1.5">
              <h4 className="text-[12px] font-semibold text-[var(--muted)]">구간</h4>

              <div className="space-y-2 pt-1">
                {selectedRoute.segments.map((seg, idx) => (
                  <div
                    key={seg.seq || idx}
                    className={`flex items-center justify-between rounded-[var(--r-sm)] border px-3 py-2.5 ${
                      seg.outdoor
                        ? 'border-[var(--warn)]/40 bg-[var(--warn-tint)]'
                        : 'border-[var(--line)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--card)]">
                        {getSegmentIcon(seg.type, seg.outdoor)}
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">
                          {seg.line || seg.route_name || (seg.outdoor ? '도보' : '실내 환승')}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--muted)]">
                          {seg.station || seg.from?.name || (seg.outdoor ? '햇빛 노출' : '실내')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="block text-[14px] font-semibold">{seg.minutes}분</span>
                      {seg.outdoor && (
                        <span className="text-[12px] text-[var(--warn)]">야외 {seg.exposure_minutes}분</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bottom Start Trip CTA — 시트와 별개로 하단에 항상 고정 (드래그·스냅 상태 무관) */}
      {selectedRoute && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-40 h-[72px] px-3 flex items-center border-t pointer-events-auto border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900`}
        >
          <button
            id="btn-confirm-route"
            onClick={handleStartTrip}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--brand)] py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--brand-strong)] active:scale-[0.99]"
          >
            <Navigation className="h-4 w-4" />
            이 경로로 이동
          </button>
        </div>
      )}
    </div>
  );
};
export default RouteCandidatesView;
