import { create } from 'zustand'
import type { Place } from '../types/api'

// 출발/도착 선택 + 최근 검색 5건 (B-02)
const RECENT_KEY = 'recent_places'

function loadRecent(): Place[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

interface RouteQueryState {
  from: Place | null
  to: Place | null
  recent: Place[]
  weather: 'mild' | 'uv_high' // 데모 날씨 토글 — 리스트/상세가 같은 값을 써야 노출부하가 일치
  departAt: string | null // 출발 예정 시각 'HH:MM' (null = 지금 출발) (B-03)
  setPlace: (target: 'from' | 'to', p: Place) => void
  addRecent: (p: Place) => void
  setWeather: (w: 'mild' | 'uv_high') => void
  setDepartAt: (t: string | null) => void
}

export const useRouteQuery = create<RouteQueryState>((set, get) => ({
  from: null,
  to: null,
  recent: loadRecent(),
  weather: 'mild',
  departAt: null,
  setPlace: (target, p) => set(target === 'from' ? { from: p } : { to: p }),
  setWeather: (w) => set({ weather: w }),
  setDepartAt: (t) => set({ departAt: t }),
  addRecent: (p) => {
    const recent = [p, ...get().recent.filter((r) => r.place_id !== p.place_id)].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    set({ recent })
  },
}))
