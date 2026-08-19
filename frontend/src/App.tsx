import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ShellLayout from './components/ShellLayout'
import Layout from './components/Layout'
import Splash from './pages/Splash'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import { useSession } from './store/session'
import PlaceSearch from './pages/PlaceSearch'
import RouteCompare from './pages/RouteCompare'
import RouteDetail from './pages/RouteDetail'
import Trip from './pages/Trip'
import Shelters from './pages/Shelters'
import Report from './pages/Report'
import Settings from './pages/Settings'
import PresetSelect from './pages/PresetSelect'
import Info from './pages/Info'
import KakaoCallback from './pages/KakaoCallback'
import History from './pages/History'
import NotFound from './pages/NotFound'

function HomeRoute() {
  const onboarded = useSession((s) => s.onboarded)
  if (!onboarded) {
    return <Navigate to="/onboarding" replace />
  }
  return <Home />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/splash" element={<Splash />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* 모든 앱 화면을 폰 너비 프레임(ShellLayout)으로 감싼다 */}
        <Route element={<ShellLayout />}>
          {/* 하단 탭 3개: 홈 / 리포트 / 설정 */}
          <Route element={<Layout />}>
            <Route index element={<HomeRoute />} />
            <Route path="/report" element={<Report />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* 탭 없는 화면 */}
          <Route path="/settings/preset" element={<PresetSelect />} />
          <Route path="/settings/info" element={<Info />} />
          <Route path="/search" element={<PlaceSearch />} />
          <Route path="/routes" element={<RouteCompare />} />
          <Route path="/routes/:routeId" element={<RouteDetail />} />
          <Route path="/trip" element={<Trip />} />
          <Route path="/trip/shelters" element={<Shelters />} />
          <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
          <Route path="/history" element={<History />} />

          <Route path="*" element={<NotFound />} />
        </Route>

        {/* 명세상 최초 진입은 스플래시지만, 개발 편의로 루트를 홈으로 둔다 */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
