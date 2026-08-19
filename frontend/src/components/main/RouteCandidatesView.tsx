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
  X
} from 'lucide-react';
import KakaoMap from '../KakaoMap';
import { api } from '../../api/client';
import { useRouteQuery } from '../../store/route';
import { useSession } from '../../store/session';
import type { Route, RouteSegment, Place } from '../../types/api';

interface RouteCandidatesViewProps {
  originName: string;
  destinationName: string;
  isDarkMode?: boolean;
  onBackToSearch: () => void;
  onShowToast: (msg: string) => void;
}

type SheetSnapState = 'collapsed' | 'half' | 'expanded';

const gradeLabel: Record<string, string> = {
  precise: '정밀 예측',
  realtime: '실시간',
  estimated: '추정',
};

export const RouteCandidatesView: React.FC<RouteCandidatesViewProps> = ({
  originName: initialOriginName,
  destinationName: initialDestName,
  isDarkMode = false,
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

  const fetchRoutes = (fromCoord: string, toCoord: string, fromName: string, toName: string) => {
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
    })
      .then((res) => {
        if (reqId !== reqIdRef.current) return; // 오래된 응답 무시
        if (res.routes && res.routes.length > 0) {
          setRoutes(res.routes);
          const recRoute = res.routes.find((r) => r.recommended) || res.routes[0];
          setSelectedRouteId(recRoute.route_id);
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
    fetchRoutes(fromParam, toParam, origin, destination);
  }, [fromLat, fromLng, toLat, toLng, preset]);

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
        {/* Back Button & Header Summary */}
        <div className="flex items-center justify-between">
          <button
            id="btn-back-to-search"
            onClick={onBackToSearch}
            className={`pointer-events-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer border ${isDarkMode
              ? 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
              : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
              }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>검색 조건 변경</span>
          </button>

          <span className={`pointer-events-auto text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md backdrop-blur-md border ${isDarkMode
            ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700/60'
            : 'text-emerald-800 bg-white/90 border-emerald-200'
            }`}>
            신체 부하 경로 분석 완료
          </span>
        </div>

        {/* Two-Line Editable Origin & Destination Card */}
        <div className={`pointer-events-auto rounded-2xl p-2.5 sm:p-3 border shadow-md backdrop-blur-md transition-colors relative z-30 space-y-1.5 ${isDarkMode ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'
          }`}>
          {/* 1. Origin Input */}
          <div className="relative">
            <div className={`flex items-center border rounded-xl px-2.5 py-1.5 transition-all ${isDarkMode
              ? 'bg-slate-800/90 border-slate-700 focus-within:border-emerald-500'
              : 'bg-slate-50 border-slate-200 focus-within:border-emerald-500'
              }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shrink-0"></span>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onFocus={() => setOriginFocused(true)}
                onBlur={() => setTimeout(() => setOriginFocused(false), 150)}
                placeholder="출발지 입력"
                className={`w-full bg-transparent text-xs font-bold placeholder-slate-400 focus:outline-none ${isDarkMode ? 'text-white' : 'text-slate-800'
                  }`}
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
                  className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl z-50 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="p-1 space-y-0.5">
                    {/* 현재 위치로 설정 (항상 상단) */}
                    <div
                      onMouseDown={(e) => { e.preventDefault(); handleUseCurrentLocation(); }}
                      className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${originSuggestions.length > 0 ? 'border-b' : ''} ${isDarkMode ? 'hover:bg-slate-800 text-emerald-400 border-slate-800' : 'hover:bg-emerald-50 text-emerald-700 border-slate-100'
                        }`}
                    >
                      <Crosshair className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-bold">📍 현재 위치로 설정</span>
                    </div>
                    {originSuggestions.map((sug) => (
                      <div
                        key={sug.place_id}
                        onClick={() => handleSelectOrigin(sug)}
                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-emerald-50 text-slate-800'
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{sug.name}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{sug.address}</span>
                          </div>
                        </div>
                        {sug.distance_m != null && (
                          <span className="text-[10px] text-slate-400 shrink-0">{sug.distance_m}m</span>
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
              className={`w-6 h-6 border rounded-full shadow-xs flex items-center justify-center transition-all cursor-pointer ${isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300 hover:text-emerald-400'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-emerald-700'
                }`}
              title="출발지/도착지 변경"
            >
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>

          {/* 2. Destination Input */}
          <div className="relative">
            <div className={`flex items-center border rounded-xl px-2.5 py-1.5 transition-all ${isDarkMode
              ? 'bg-slate-800/90 border-slate-700 focus-within:border-emerald-500'
              : 'bg-slate-50 border-slate-200 focus-within:border-emerald-500'
              }`}>
              <span className="w-2 h-2 rounded-full bg-rose-500 mr-2 shrink-0"></span>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="도착지 입력"
                className={`w-full bg-transparent text-xs font-bold placeholder-slate-400 focus:outline-none ${isDarkMode ? 'text-white' : 'text-slate-800'
                  }`}
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
                  className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl z-50 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="p-1 space-y-0.5">
                    {destSuggestions.map((sug) => (
                      <div
                        key={sug.place_id}
                        onClick={() => handleSelectDest(sug)}
                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-emerald-50 text-slate-800'
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{sug.name}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{sug.address}</span>
                          </div>
                        </div>
                        {sug.distance_m != null && (
                          <span className="text-[10px] text-slate-400 shrink-0">{sug.distance_m}m</span>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-md backdrop-blur-md transition-all whitespace-nowrap cursor-pointer ${isSelected
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-950/30'
                    : isDarkMode
                      ? 'bg-slate-900/85 border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                >
                  {r.recommended && (
                    <span className={`text-[9px] px-1 py-0.2 rounded font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                      추천
                    </span>
                  )}
                  {r.route_type === 'walk' && (
                    <span className={`flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                      }`}>
                      <Footprints className="w-2.5 h-2.5" />도보
                    </span>
                  )}
                  <span>{r.total_minutes}분</span>
                  <span className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    (부하 {r.exposure_load})
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
          <div className={`p-4 rounded-2xl border shadow-xl flex items-center gap-2.5 text-xs font-bold ${isDarkMode ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200'
            }`}>
            <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
            <span>최적의 대중교통 웰니스 경로 계산 중...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
          <div className={`max-w-xs w-full p-5 rounded-2xl border shadow-xl text-center space-y-3 ${isDarkMode ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200'
            }`}>
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
          className={`absolute bottom-[72px] left-0 right-0 z-30 rounded-t-3xl border-t shadow-2xl transition-colors duration-200 flex flex-col pointer-events-auto ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}
        >
          {/* Grab Handle Header with Real-time Pan Gestures */}
          <motion.div
            onPanStart={handlePanStart}
            onPan={handlePan}
            onPanEnd={handlePanEnd}
            onClick={toggleSnap}
            className="w-full pt-3 pb-2.5 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 select-none touch-none"
          >
            <div className={`w-10 h-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-300 hover:bg-slate-400'} transition-colors`} />
          </motion.div>

          {/* Sheet Main Header */}
          <div className="px-4 pb-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                {selectedRoute.recommended && (
                  <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                    추천
                  </span>
                )}
                <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {gradeLabel[selectedRoute.prediction_grade] || '실시간 예측'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-emerald-500">
                  {selectedRoute.total_minutes}분
                </span>
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  환승 {selectedRoute.transfers}회 · 실내 {Math.round(selectedRoute.indoor_ratio * 100)}%
                </span>
              </div>
            </div>

            {/* Exposure Score Badge */}
            <div className="text-right">
              <span className={`text-[10px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                신체 노출 부하
              </span>
              <span className={`text-lg sm:text-xl font-black ${selectedRoute.exposure_load <= 40 ? 'text-emerald-500' : 'text-amber-500'
                }`}>
                {selectedRoute.exposure_load}점
              </span>
            </div>
          </div>

          {/* Sheet Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* 출발시각 넛지 배너 — 실시간 버스 대기가 길 때만 */}
            {selectedRoute.depart_nudge && (
              <div className={`p-3 rounded-2xl border text-xs leading-relaxed transition-colors ${isDarkMode ? 'bg-sky-950/30 border-sky-900/50 text-sky-200' : 'bg-sky-50/70 border-sky-200 text-sky-900'
                }`}>
                <div className="flex items-center gap-1 font-bold mb-1 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-sky-500" />
                  <span>출발시각 팁 · {selectedRoute.depart_nudge.delay_minutes}분 늦게</span>
                </div>
                <p className="text-[11px] font-medium">{selectedRoute.depart_nudge.text}</p>
              </div>
            )}

            {/* LLM Coaching Banner */}
            {selectedRoute.llm_comment && (
              <div className={`p-3 rounded-2xl border text-xs leading-relaxed transition-colors ${isDarkMode ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-200' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                }`}>
                <div className="flex items-center gap-1 font-bold mb-1 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>맞춤형 웰니스 코칭</span>
                </div>
                <p className="text-[11px] font-medium">{selectedRoute.llm_comment}</p>
              </div>
            )}

            {/* Timeline Segment Flow */}
            <div className="space-y-1.5">
              <h4 className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                구간별 상세 이동 경로
              </h4>

              <div className="space-y-2 pt-1">
                {selectedRoute.segments.map((seg, idx) => (
                  <div
                    key={seg.seq || idx}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${seg.outdoor
                      ? isDarkMode
                        ? 'border-amber-800/50 bg-amber-950/20'
                        : 'border-amber-200 bg-amber-50/50'
                      : isDarkMode
                        ? 'border-slate-800 bg-slate-800/40'
                        : 'border-slate-100 bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-white shadow-2xs'
                        }`}>
                        {getSegmentIcon(seg.type, seg.outdoor)}
                      </div>
                      <div className="min-w-0">
                        <span className={`font-bold block truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'
                          }`}>
                          {seg.line || seg.route_name || (seg.outdoor ? '야외 보행' : '실내 보행/환승')}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {seg.station || seg.from?.name || (seg.outdoor ? '직사광선 노출 주의' : '쾌적 실내 구간')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold block">{seg.minutes}분</span>
                      <span className={`text-[10px] ${seg.outdoor ? 'text-amber-500 font-semibold' : 'text-emerald-500'}`}>
                        {seg.outdoor ? `야외 ${seg.exposure_minutes}분` : '실내 100%'}
                      </span>
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
          className={`absolute bottom-0 left-0 right-0 z-40 h-[72px] px-3 flex items-center border-t pointer-events-auto ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
            }`}
        >
          <button
            id="btn-confirm-route"
            onClick={handleStartTrip}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>실시간 안심 이동 안내 시작하기</span>
          </button>
        </div>
      )}
    </div>
  );
};
export default RouteCandidatesView;
