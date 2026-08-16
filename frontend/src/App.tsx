import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Login from './pages/Login'
import Signup from './pages/Signup'
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

        {/* 하단 탭 3개: 홈 / 리포트 / 설정 */}
        <Route element={<Layout />}>
          <Route index element={<HomeRoute />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* 전체 화면 (탭 없음) */}
        <Route path="/search" element={<PlaceSearch />} />
        <Route path="/routes" element={<RouteCompare />} />
        <Route path="/routes/:routeId" element={<RouteDetail />} />
        <Route path="/trip" element={<Trip />} />
        <Route path="/trip/shelters" element={<Shelters />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/history" element={<History />} />

        <Route path="*" element={<NotFound />} />
        {/* 명세상 최초 진입은 스플래시지만, 개발 편의로 루트를 홈으로 둔다 */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
