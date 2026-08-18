import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import InstallBanner from './InstallBanner'

// 모든 앱 화면을 폰 너비(480px) 중앙 프레임으로 감싼다 (데스크톱에서도 일관된 모바일 뷰)
export default function ShellLayout() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme_dark_mode')
      if (saved !== null) return saved === 'true'
      if (window.matchMedia) return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    const handleThemeChange = () => {
      const saved = localStorage.getItem('theme_dark_mode')
      if (saved !== null) setIsDarkMode(saved === 'true')
    }
    window.addEventListener('storage', handleThemeChange)
    window.addEventListener('theme-change', handleThemeChange)
    return () => {
      window.removeEventListener('storage', handleThemeChange)
      window.removeEventListener('theme-change', handleThemeChange)
    }
  }, [])

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  return (
    <div className={`app-shell transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <ErrorBoundary>
        <Outlet />
        <InstallBanner />
      </ErrorBoundary>
    </div>
  )
}
