import { Outlet } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import InstallBanner from './InstallBanner'
import { useTheme } from '../store/theme'

// 모든 앱 화면을 폰 너비(480px) 중앙 프레임으로 감싼다 (데스크톱에서도 일관된 모바일 뷰).
// 테마는 store/theme 하나가 소유하고 html.dark 클래스로 내려간다 → 색은 CSS 토큰이 따라온다.
export default function ShellLayout() {
  useTheme((s) => s.isDark) // 테마 변경 시 리렌더 (클래스 적용은 store가 담당)

  return (
    <div className="app-shell">
      <ErrorBoundary>
        <Outlet />
        <InstallBanner />
      </ErrorBoundary>
    </div>
  )
}
