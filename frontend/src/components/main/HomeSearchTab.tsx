import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  ArrowUpDown,
  Search,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
  Clock,
  X,
  ChevronDown,
  Navigation,
  Trash2,
  Building,
  Crosshair,
  Star
} from 'lucide-react';
import type { Preset, Environment, Place } from '../../types/api';
import { useRouteQuery } from '../../store/route';
import { api } from '../../api/client';

interface HomeSearchTabProps {
  userPreset: Preset;
  isDarkMode?: boolean;
  onRequestRouteCandidates: (originName: string, destName: string) => void;
  onShowToast: (msg: string) => void;
  locationName?: string;
  lat?: number;
  lng?: number;
}

const PRESET_COACHING: Record<Preset, { badge: string; text: string; icon: string }> = {
  skin: {
    badge: '피부·자외선 집중 케어 경로',
    text: '자외선 지수가 높은 시간대에는 직사광선 야외 대기를 15분 이상 피하고 지하/실내 환승 구간을 추천해요 ☀️',
    icon: '☀️',
  },
  heat: {
    badge: '더위·추위 온도 적응 경로',
    text: '체감온도 변화가 심한 날씨입니다. 냉난방 시설이 갖춰진 지하철 및 실내 환승 구역을 우선 안내합니다 ❄️',
    icon: '🌡️',
  },
  respiratory: {
    badge: '호흡기·미세먼지 안심 경로',
    text: '도로변 매연과 미세먼지 노출 구간을 우회하고 공기정화가 지원되는 청정 대기 경로로 안내합니다 🌿',
    icon: '💨',
  },
  normal: {
    badge: '스마트 밸런스 균형 경로',
    text: '이동 시간과 신체 노출 부하(자외선/온도/매연)를 종합 최적화한 쾌적한 출퇴근 경로를 제공합니다 🧭',
    icon: '⚖️',
  },
};

export const HomeSearchTab: React.FC<HomeSearchTabProps> = ({
  userPreset,
  isDarkMode = false,
  onRequestRouteCandidates,
  onShowToast,
  locationName = '서울시 강남구',
  lat = 37.2011,
  lng = 127.0983,
}) => {
  const fromPlace = useRouteQuery((s) => s.from);
  const toPlace = useRouteQuery((s) => s.to);
  const setPlace = useRouteQuery((s) => s.setPlace);
  const recent = useRouteQuery((s) => s.recent);
  const favorites = useRouteQuery((s) => s.favorites);
  const addRecent = useRouteQuery((s) => s.addRecent);
  const removeRecent = useRouteQuery((s) => s.removeRecent);
  const clearRecent = useRouteQuery((s) => s.clearRecent);
  const toggleFavorite = useRouteQuery((s) => s.toggleFavorite);
  const departAt = useRouteQuery((s) => s.departAt);
  const setDepartAt = useRouteQuery((s) => s.setDepartAt);

  const [origin, setOrigin] = useState(fromPlace?.name || locationName || '서울시 강남구');
  const [destination, setDestination] = useState(toPlace?.name || '');
  const [departTime, setDepartTime] = useState(departAt ? `${departAt} 출발` : '지금 출발');
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [envData, setEnvData] = useState<Environment | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Auto-complete suggestions for origin & destination
  const [originSuggestions, setOriginSuggestions] = useState<Place[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState<Place[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [destFocused, setDestFocused] = useState(false); // 포커스 시(빈 입력) 최근/즐겨찾기 드롭다운 (#1)
  const [originFocused, setOriginFocused] = useState(false);

  // 최근·즐겨찾기 병합(즐겨찾기 우선, 중복 제거) — 포커스 드롭다운용
  const quickPicks = [
    ...favorites,
    ...recent.filter((r) => !favorites.some((f) => f.place_id === r.place_id)),
  ].slice(0, 6);
  const showDestQuick = destFocused && destSuggestions.length === 0 && quickPicks.length > 0;
  // 출발지: 포커스+빈입력이면 '현재 위치로 설정' + 즐겨찾기·최근 (항상 현재위치 옵션은 보임)
  const showOriginQuick = originFocused && originSuggestions.length === 0;

  const coaching = PRESET_COACHING[userPreset] || PRESET_COACHING.normal;

  useEffect(() => {
    api.getEnvironment(lat, lng)
      .then((data) => {
        setEnvData(data);
        setSecondsAgo(0);
      })
      .catch(() => setEnvData(null));
  }, [lat, lng]);

  // Elapsed seconds timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync origin with actual address when locationName or fromPlace changes
  useEffect(() => {
    if (fromPlace?.name && fromPlace.name !== '현재 위치' && fromPlace.name !== '📍 현재 위치') {
      setOrigin(fromPlace.name);
    } else if (locationName) {
      setOrigin(locationName);
    }
  }, [fromPlace?.name, locationName]);

  // Debounced Place Search for Origin
  useEffect(() => {
    const term = origin.trim();
    if (!term || term === fromPlace?.name || term === locationName) {
      setOriginSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingOrigin(true);
      api.searchPlaces(term, lat, lng)
        .then((places) => setOriginSuggestions(places.slice(0, 5)))
        .catch(() => setOriginSuggestions([]))
        .finally(() => setIsSearchingOrigin(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [origin, lat, lng, fromPlace?.name, locationName]);

  // Debounced Place Search for Destination
  useEffect(() => {
    const term = destination.trim();
    if (!term || term === toPlace?.name) {
      setDestSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingDest(true);
      api.searchPlaces(term, lat, lng)
        .then((places) => setDestSuggestions(places.slice(0, 5)))
        .catch(() => setDestSuggestions([]))
        .finally(() => setIsSearchingDest(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [destination, lat, lng, toPlace?.name]);

  const handleSwap = () => {
    if (!destination) {
      onShowToast('도착지를 먼저 입력해주세요.');
      return;
    }
    const tempOrigin = origin;
    const tempDest = destination;
    setOrigin(tempDest);
    setDestination(tempOrigin);
    if (fromPlace && toPlace) {
      setPlace('from', toPlace);
      setPlace('to', fromPlace);
    }
    setOriginSuggestions([]);
    setDestSuggestions([]);
    onShowToast('출발지와 도착지를 바꿨습니다.');
  };

  const handleSelectOriginSuggestion = (place: Place) => {
    setOrigin(place.name);
    setPlace('from', place);
    addRecent(place);
    setOriginSuggestions([]);
    setOriginFocused(false); // 선택 후 드롭다운 닫기 (도착지와 동일 동작)
    onShowToast(`출발지로 '${place.name}'을(를) 선택했습니다.`);
  };

  const handleResetCurrentLocation = () => {
    const currentAddr = locationName || '현재 위치';
    setOrigin(currentAddr);
    setPlace('from', {
      place_id: 'current',
      name: currentAddr,
      address: currentAddr,
      category: '',
      lat,
      lng,
    });
    setOriginSuggestions([]);
    setOriginFocused(false); // 선택 후 드롭다운 닫기
    onShowToast('출발지를 현재 위치로 설정했습니다.');
  };

  const handleSelectDestSuggestion = (place: Place) => {
    setDestination(place.name);
    setPlace('to', place);
    addRecent(place);
    setDestSuggestions([]);
    onShowToast(`목적지로 '${place.name}'을(를) 선택했습니다.`);
  };

  const handleSelectRecent = (place: Place) => {
    setDestination(place.name);
    setPlace('to', place);
    setDestSuggestions([]);
    onShowToast(`목적지로 '${place.name}'을(를) 선택했습니다.`);
  };

  const handleDeleteRecent = (placeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecent(placeId);
    onShowToast('검색 기록이 삭제되었습니다.');
  };

  const handleClearAllRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearRecent();
    onShowToast('모든 검색 기록이 삭제되었습니다.');
  };

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const finalOrigin = origin.trim() || locationName || '서울시 강남구';
    const finalDest = destination.trim() || '강남역 2호선';

    // 출발지=목적지면 경로가 없어 상세 화면이 오류 → 검색 단계에서 차단 (이름 또는 좌표 동일)
    const sameCoord = !!fromPlace && !!toPlace && fromPlace.lat === toPlace.lat && fromPlace.lng === toPlace.lng;
    if (finalOrigin === finalDest || sameCoord) {
      onShowToast('출발지와 도착지가 같아요. 다른 장소를 선택해주세요.');
      return;
    }

    // Ensure fromPlace is valid
    if (!fromPlace || fromPlace.name !== finalOrigin) {
      setPlace('from', {
        place_id: `from_${Date.now()}`,
        name: finalOrigin,
        address: finalOrigin,
        category: '출발지',
        lat: fromPlace?.lat ?? lat,
        lng: fromPlace?.lng ?? lng,
      });
    }

    // Ensure toPlace is valid
    if (!toPlace || toPlace.name !== finalDest) {
      const newDestPlace: Place = {
        place_id: `place_${Date.now()}`,
        name: finalDest,
        address: finalDest,
        category: '목적지',
        lat: toPlace?.lat ?? 37.4979,
        lng: toPlace?.lng ?? 127.0276,
      };
      setPlace('to', newDestPlace);
      addRecent(newDestPlace);
    }

    setOriginSuggestions([]);
    setDestSuggestions([]);
    onRequestRouteCandidates(finalOrigin, finalDest);
  };

  return (
    <motion.div
      key="tab-home-search"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Top Location Header */}
      <div className="py-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-950 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
            }`}>
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {locationName}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm shrink-0 ${isDarkMode ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100/70 text-emerald-800'
                }`}>
                현재 위치
              </span>
            </div>
            <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              현재 위치 기준 실시간 노출 부하 분석
            </p>
          </div>
        </div>
      </div>

      {/* Today's Environment Card */}
      <div
        id="environmental-status-card"
        className={`rounded-2xl p-4 border shadow-xs transition-colors ${isDarkMode
            ? 'bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 border-emerald-900/40 text-slate-100'
            : 'bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-emerald-100/80 text-slate-800'
          }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-1 text-[11px] font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-900'
            }`}>
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>현재 위치 환경 정보</span>
          </div>
          <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {secondsAgo < 60 ? `최근 업데이트: ${secondsAgo}초 전` : `최근 업데이트: ${Math.floor(secondsAgo / 60)}분 전`}
          </span>
        </div>

        {/* 3 Weather / Environment Badges */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Feels Like Temp */}
          <div className={`rounded-xl p-2 border text-center transition-colors ${isDarkMode ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/80 border-slate-100'
            }`}>
            <div className={`flex items-center justify-center gap-1 mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'
              }`}>
              <Thermometer className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[10px] font-medium">체감온도</span>
            </div>
            <div className={`text-xs sm:text-sm font-black ${envData?.temperature?.feels_like != null
                ? isDarkMode ? 'text-white' : 'text-slate-800'
                : 'text-slate-400'
              }`}>
              {envData?.temperature?.feels_like != null ? `${envData.temperature.feels_like}℃` : '—'}
            </div>
          </div>

          {/* UV Index */}
          <div className={`rounded-xl p-2 border text-center transition-colors ${isDarkMode ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/80 border-slate-100'
            }`}>
            <div className={`flex items-center justify-center gap-1 mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'
              }`}>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-medium">자외선</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-amber-500">
              {envData?.uv?.index != null ? `${envData.uv.index} ${envData.uv.grade || ''}`.trim() : '0 낮음'}
            </div>
          </div>

          {/* PM10 Dust */}
          <div className={`rounded-xl p-2 border text-center transition-colors ${isDarkMode ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/80 border-slate-100'
            }`}>
            <div className={`flex items-center justify-center gap-1 mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'
              }`}>
              <Wind className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium">미세먼지</span>
            </div>
            <div className={`text-xs sm:text-sm font-black ${envData?.air?.pm10 != null && envData?.air?.pm10_grade ? 'text-emerald-500' : 'text-slate-400'
              }`}>
              {envData?.air?.pm10 != null && envData?.air?.pm10_grade ? `${envData.air.pm10}㎍ ${envData.air.pm10_grade}` : '—'}
            </div>
          </div>
        </div>

        {/* Personalized Coaching message based on userPreset */}
        <div className={`rounded-xl p-3 border shadow-2xs transition-colors ${isDarkMode
            ? 'bg-slate-900/90 border-slate-700/80'
            : 'bg-white border-emerald-100/60'
          }`}>
          <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'
            }`}>
            <span>{coaching.icon}</span>
            <span>{coaching.badge}</span>
          </div>
          <p className={`text-[11px] leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}>
            {coaching.text}
          </p>
        </div>
      </div>

      {/* Origin / Destination Search Form */}
      <form
        onSubmit={handleSubmitSearch}
        className={`rounded-2xl p-4 border shadow-xs space-y-3 transition-colors ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80'
          }`}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-xs font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-slate-800'
            }`}>
            <Navigation className="w-3.5 h-3.5 text-emerald-500" />
            <span>최소 부하 경로 탐색</span>
          </h2>

          {/* Time Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border rounded-lg transition-colors cursor-pointer ${isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
            >
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{departTime}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isTimeDropdownOpen && (
              <div className={`absolute right-0 mt-1 w-44 border rounded-xl shadow-lg p-1.5 z-20 text-[11px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-600'
                }`}>
                {/* 지금 출발 (기본) */}
                <button
                  type="button"
                  onClick={() => { setDepartTime('지금 출발'); setDepartAt(null); setIsTimeDropdownOpen(false); }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg cursor-pointer ${!departAt
                      ? isDarkMode ? 'font-bold text-emerald-400 bg-emerald-950/40' : 'font-bold text-emerald-700 bg-emerald-50/50'
                      : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-emerald-50'
                    }`}
                >
                  지금 출발
                </button>
                {/* 시각 지정 — --:-- 를 바로 눌러 설정(네이티브 피커 즉시 오픈), 선택 시 닫힘 */}
                <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-emerald-50'}`}>
                  <span className="shrink-0">시각 지정</span>
                  <input
                    type="time"
                    value={departAt && /^\d{1,2}:\d{2}$/.test(departAt) ? departAt : ''}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) { setDepartAt(v); setDepartTime(`${v} 출발`); setIsTimeDropdownOpen(false); }
                    }}
                    className={`flex-1 min-w-0 bg-transparent border rounded-md px-1.5 py-0.5 text-[11px] cursor-pointer focus:outline-none focus:border-emerald-500 ${isDarkMode ? 'border-slate-600 text-white [color-scheme:dark]' : 'border-slate-300 text-slate-800'
                      }`}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Inputs with Swap Button & Real-time Auto-complete */}
        <div className="relative space-y-2">
          {/* Origin Input with Search Suggestions */}
          <div className="relative">
            <div className={`flex items-center border rounded-xl px-3 py-2.5 transition-all ${isDarkMode
                ? 'bg-slate-800/80 border-slate-700 focus-within:border-emerald-500 focus-within:bg-slate-800'
                : 'bg-slate-50 border-slate-200 focus-within:border-emerald-500 focus-within:bg-white'
              }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shrink-0"></span>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                onFocus={() => setOriginFocused(true)}
                onBlur={() => setTimeout(() => setOriginFocused(false), 150)}
                placeholder="출발지 입력 (예: 강남역, 판교역)"
                className={`w-full bg-transparent text-xs font-semibold placeholder-slate-400 focus:outline-none ${isDarkMode ? 'text-white' : 'text-slate-800'
                  }`}
              />
              {isSearchingOrigin ? (
                <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0 mr-1" />
              ) : origin ? (
                <button
                  type="button"
                  onClick={() => {
                    setOrigin('');
                    setOriginSuggestions([]);
                  }}
                  className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                  title="지우기"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Origin Dropdown: 입력 시 검색후보 / 포커스+빈입력 시 현재위치 + 즐겨찾기·최근 (#1) */}
            <AnimatePresence>
              {(originSuggestions.length > 0 || showOriginQuick) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-40 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="p-1.5 space-y-1">
                    {/* Current Location Option (항상 상단) */}
                    <div
                      onMouseDown={(e) => { e.preventDefault(); handleResetCurrentLocation(); }}
                      className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors border-b ${isDarkMode
                          ? 'hover:bg-slate-800 text-emerald-400 border-slate-800'
                          : 'hover:bg-emerald-50 text-emerald-700 border-slate-100'
                        }`}
                    >
                      <Crosshair className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-bold">📍 현재 위치로 설정 ({locationName})</span>
                    </div>

                    {originSuggestions.length > 0 ? (
                      originSuggestions.map((sug) => (
                        <div
                          key={sug.place_id}
                          onClick={() => handleSelectOriginSuggestion(sug)}
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
                          <div className="flex items-center gap-1 shrink-0">
                            {sug.distance_m != null && (
                              <span className="text-[10px] text-slate-400">{sug.distance_m}m</span>
                            )}
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleFavorite(sug); }} title="즐겨찾기" className="p-0.5">
                              <Star className={`w-3.5 h-3.5 ${favorites.some((f) => f.place_id === sug.place_id) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : quickPicks.length > 0 ? (
                      <>
                        <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold text-slate-400">⭐ 즐겨찾기 · 최근</div>
                        {quickPicks.map((p) => (
                          <div
                            key={p.place_id}
                            onMouseDown={(e) => { e.preventDefault(); handleSelectOriginSuggestion(p); }}
                            className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-emerald-50 text-slate-800'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {favorites.some((f) => f.place_id === p.place_id)
                                ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                                : <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                              <div className="min-w-0">
                                <span className="text-xs font-bold block truncate">{p.name}</span>
                                <span className="text-[10px] text-slate-400 block truncate">{p.address || p.category || '최근 장소'}</span>
                              </div>
                            </div>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(p); }} title="즐겨찾기" className="p-0.5 shrink-0">
                              <Star className={`w-3.5 h-3.5 ${favorites.some((f) => f.place_id === p.place_id) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                            </button>
                          </div>
                        ))}
                      </>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Swap Button in between */}
          <div className="absolute right-3 top-[26px] z-10">
            <button
              type="button"
              onClick={handleSwap}
              className={`w-7 h-7 border rounded-full shadow-xs flex items-center justify-center transition-all cursor-pointer ${isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-emerald-400'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-emerald-700'
                }`}
              title="출발지/도착지 변경"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Destination Input with Search Suggestions */}
          <div className="relative">
            <div className={`flex items-center border rounded-xl px-3 py-2.5 transition-all ${isDarkMode
                ? 'bg-slate-800/80 border-slate-700 focus-within:border-emerald-500 focus-within:bg-slate-800'
                : 'bg-slate-50 border-slate-200 focus-within:border-emerald-500 focus-within:bg-white'
              }`}>
              <span className="w-2 h-2 rounded-full bg-rose-500 mr-2 shrink-0"></span>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onFocus={() => setDestFocused(true)}
                onBlur={() => setTimeout(() => setDestFocused(false), 150)}
                placeholder="어디로 가시나요? (예: 강남역, 판교역)"
                className={`w-full bg-transparent text-xs font-semibold placeholder-slate-400 focus:outline-none ${isDarkMode ? 'text-white' : 'text-slate-800'
                  }`}
              />
              {isSearchingDest ? (
                <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0 mr-1" />
              ) : destination ? (
                <button
                  type="button"
                  onClick={() => {
                    setDestination('');
                    setDestSuggestions([]);
                  }}
                  className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                  title="지우기"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Destination Dropdown: 입력 시 검색후보 / 포커스+빈입력 시 즐겨찾기·최근 (#1) */}
            <AnimatePresence>
              {(destSuggestions.length > 0 || showDestQuick) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-30 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                >
                  <div className="p-1.5 space-y-1">
                    {destSuggestions.length > 0
                      ? destSuggestions.map((sug) => (
                        <div
                          key={sug.place_id}
                          onClick={() => handleSelectDestSuggestion(sug)}
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
                          <div className="flex items-center gap-1 shrink-0">
                            {sug.distance_m != null && (
                              <span className="text-[10px] text-slate-400">{sug.distance_m}m</span>
                            )}
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleFavorite(sug); }} title="즐겨찾기" className="p-0.5">
                              <Star className={`w-3.5 h-3.5 ${favorites.some((f) => f.place_id === sug.place_id) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                            </button>
                          </div>
                        </div>
                      ))
                      : (
                        <>
                          <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold text-slate-400">⭐ 즐겨찾기 · 최근</div>
                          {quickPicks.map((p) => (
                            <div
                              key={p.place_id}
                              onClick={() => handleSelectRecent(p)}
                              className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-emerald-50 text-slate-800'
                                }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {favorites.some((f) => f.place_id === p.place_id)
                                  ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                                  : <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                <div className="min-w-0">
                                  <span className="text-xs font-bold block truncate">{p.name}</span>
                                  <span className="text-[10px] text-slate-400 block truncate">{p.address || p.category || '최근 목적지'}</span>
                                </div>
                              </div>
                              <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleFavorite(p); }} title="즐겨찾기" className="p-0.5 shrink-0">
                                <Star className={`w-3.5 h-3.5 ${favorites.some((f) => f.place_id === p.place_id) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Submit Route Search Button */}
        <button
          id="btn-search-route"
          type="submit"
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>신체 부하 최소화 경로 후보 검색하기</span>
        </button>
      </form>

      {/* Recent Search Places List (Real User Data from useRouteQuery) */}
      <div className={`rounded-2xl p-4 border shadow-xs transition-colors ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80'
        }`}>
        <div className="flex items-center justify-between mb-2.5">
          <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            최근 검색한 장소
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">{recent.length}개 저장됨</span>
            {recent.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllRecent}
                className="text-[10px] text-rose-500 hover:text-rose-600 font-medium flex items-center gap-0.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>전체 삭제</span>
              </button>
            )}
          </div>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-5">
            <Clock className="w-6 h-6 text-slate-300 dark:text-slate-700 mx-auto mb-1.5" />
            <p className="text-xs text-slate-400">최근 검색한 장소 기록이 없습니다.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">목적지를 검색하면 여기에 자동으로 저장됩니다.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recent.map((place) => (
              <div
                key={place.place_id}
                onClick={() => handleSelectRecent(place)}
                className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${isDarkMode
                    ? 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700'
                    : 'border-slate-100 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-200'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-500 shadow-2xs'
                    }`}>
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-bold block truncate ${isDarkMode ? 'text-slate-200 group-hover:text-emerald-400' : 'text-slate-800 group-hover:text-emerald-700'
                      }`}>
                      {place.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {place.address || place.category || '최근 목적지'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(place); }}
                    className="p-1 cursor-pointer"
                    title="즐겨찾기"
                  >
                    <Star className={`w-3.5 h-3.5 ${favorites.some((f) => f.place_id === place.place_id) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRecent(place.place_id, e)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors opacity-60 hover:opacity-100 cursor-pointer"
                    title="기록 삭제"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
export default HomeSearchTab;
