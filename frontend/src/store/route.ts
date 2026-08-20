import { create } from 'zustand'
import type { Place } from '../types/api'

// 출발/도착 선택 + 최근 검색 5건 (B-02) + 즐겨찾기
const RECENT_KEY = 'recent_places'
const FAV_KEY = 'favorite_places'

function load(key: string): Place[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}
const loadRecent = () => load(RECENT_KEY)

export const DEMO_FROM: Place = {
  place_id: 'demo_dongtan',
  name: '동탄역',
  address: '경기 화성시 오산동 998',
  category: '지하철/SRT',
  lat: 37.2011,
  lng: 127.0983,
}

export const DEMO_TO: Place = {
  place_id: 'demo_gangnam',
  name: '강남역',
  address: '서울 강남구 역삼동 858',
  category: '지하철역',
  lat: 37.4979,
  lng: 127.0276,
}

interface RouteQueryState {
  from: Place | null
  to: Place | null
  recent: Place[]
  favorites: Place[] // 즐겨찾기 장소
  weather: 'mild' | 'uv_high' // 데모 날씨 토글 — 리스트/상세가 같은 값을 써야 노출부하가 일치
  isDemoActive: boolean // 데모 시연 모드 활성화 여부
  departAt: string | null // 출발 예정 시각 'HH:MM' (null = 지금 출발) (B-03)
  setPlace: (target: 'from' | 'to', p: Place) => void
  addRecent: (p: Place) => void
  removeRecent: (placeId: string) => void
  clearRecent: () => void
  toggleFavorite: (p: Place) => void
  isFavorite: (placeId: string) => boolean
  setWeather: (w: 'mild' | 'uv_high') => void
  setDepartAt: (t: string | null) => void
  startDemoSession: (scenario?: string) => void
  exitDemoSession: () => void
}

export const useRouteQuery = create<RouteQueryState>((set, get) => ({
  from: null,
  to: null,
  recent: loadRecent(),
  favorites: load(FAV_KEY),
  weather: 'mild',
  isDemoActive: false,
  departAt: null,
  setPlace: (target, p) => set(target === 'from' ? { from: p } : { to: p }),
  setWeather: (w) => set({ weather: w }),
  setDepartAt: (t) => set({ departAt: t }),
  startDemoSession: (_scenario) => {
    set({
      isDemoActive: true,
      weather: 'mild',
      from: DEMO_FROM,
      to: DEMO_TO,
    })
  },
  exitDemoSession: () => {
    set({
      isDemoActive: false,
      weather: 'mild',
    })
  },
  addRecent: (p) => {
    const recent = [p, ...get().recent.filter((r) => r.place_id !== p.place_id && r.name !== p.name)].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    set({ recent })
  },
  removeRecent: (placeId) => {
    const recent = get().recent.filter((r) => r.place_id !== placeId)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    set({ recent })
  },
  clearRecent: () => {
    localStorage.removeItem(RECENT_KEY)
    set({ recent: [] })
  },
  toggleFavorite: (p) => {
    const exists = get().favorites.some((f) => f.place_id === p.place_id)
    const favorites = exists
      ? get().favorites.filter((f) => f.place_id !== p.place_id)
      : [p, ...get().favorites].slice(0, 10)
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites))
    set({ favorites })
  },
  isFavorite: (placeId) => get().favorites.some((f) => f.place_id === placeId),
}))
