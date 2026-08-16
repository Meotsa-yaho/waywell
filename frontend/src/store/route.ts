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
  setPlace: (target: 'from' | 'to', p: Place) => void
  addRecent: (p: Place) => void
}

export const useRouteQuery = create<RouteQueryState>((set, get) => ({
  from: null,
  to: null,
  recent: loadRecent(),
  setPlace: (target, p) => set(target === 'from' ? { from: p } : { to: p }),
  addRecent: (p) => {
    const recent = [p, ...get().recent.filter((r) => r.place_id !== p.place_id)].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    set({ recent })
  },
}))
