import { create } from 'zustand'
import type { Preset } from '../types/api'

// 최초 실행 시 게스트 device_id 발급 (A-04)
function ensureDeviceId(): string {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('device_id', id)
  }
  return id
}

interface SessionState {
  deviceId: string
  token: string | null
  preset: Preset
  onboarded: boolean
  setToken: (t: string | null) => void
  setPreset: (p: Preset) => void
  completeOnboarding: () => void
  logout: () => void
}

export const useSession = create<SessionState>((set) => ({
  deviceId: ensureDeviceId(),
  token: localStorage.getItem('access_token'),
  preset: (localStorage.getItem('preset') as Preset) || 'normal',
  onboarded: localStorage.getItem('onboarded') === 'true',

  setToken: (t) => {
    if (t) localStorage.setItem('access_token', t)
    else localStorage.removeItem('access_token')
    set({ token: t })
  },
  setPreset: (p) => {
    localStorage.setItem('preset', p)
    set({ preset: p })
  },
  completeOnboarding: () => {
    localStorage.setItem('onboarded', 'true')
    set({ onboarded: true })
  },
  logout: () => {
    localStorage.removeItem('access_token')
    set({ token: null })
  },
}))
