import { Outlet } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import InstallBanner from './InstallBanner'

// 모든 앱 화면을 폰 너비(480px) 중앙 프레임으로 감싼다 (데스크톱에서도 일관된 모바일 뷰)
export default function ShellLayout() {
  return (
    <div className="app-shell">
      <ErrorBoundary>
        <Outlet />
        <InstallBanner />
      </ErrorBoundary>
    </div>
  )
}
