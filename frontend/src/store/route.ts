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

interface RouteQueryState {
  from: Place | null
  to: Place | null
  recent: Place[]
  favorites: Place[] // 즐겨찾기 장소
  weather: 'mild' | 'uv_high' // 데모 날씨 토글 — 리스트/상세가 같은 값을 써야 노출부하가 일치
  departAt: string | null // 출발 예정 시각 'HH:MM' (null = 지금 출발) (B-03)
  setPlace: (target: 'from' | 'to', p: Place) => void
  addRecent: (p: Place) => void
  removeRecent: (placeId: string) => void
  clearRecent: () => void
  toggleFavorite: (p: Place) => void
  isFavorite: (placeId: string) => boolean
  setWeather: (w: 'mild' | 'uv_high') => void
  setDepartAt: (t: string | null) => void
}

export const useRouteQuery = create<RouteQueryState>((set, get) => ({
  from: null,
  to: null,
  recent: loadRecent(),
  favorites: load(FAV_KEY),
  weather: 'mild',
  departAt: null,
  setPlace: (target, p) => set(target === 'from' ? { from: p } : { to: p }),
  setWeather: (w) => set({ weather: w }),
  setDepartAt: (t) => set({ departAt: t }),
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
