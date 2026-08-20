import { create } from 'zustand'

// 다크모드 상태 — html.dark 클래스가 실제 소유자. Tailwind dark: 도 이걸 본다.

const KEY = 'theme_dark_mode'

function initialDark(): boolean {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem(KEY)
  if (saved !== null) return saved === 'true'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applyToDocument(dark: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', dark)
}

interface ThemeState {
  isDark: boolean
  setDark: (v: boolean) => void
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => {
  const dark = initialDark()
  applyToDocument(dark) // 첫 페인트 전에 클래스를 붙여 깜빡임 방지
  return {
    isDark: dark,
    setDark: (v) => {
      localStorage.setItem(KEY, String(v))
      applyToDocument(v)
      set({ isDark: v })
      // 아직 자체 state로 테마를 읽는 화면들용 (전환 끝나면 제거)
      window.dispatchEvent(new Event('theme-change'))
    },
    toggle: () => get().setDark(!get().isDark),
  }
})
