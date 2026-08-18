import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

// 하단 탭바가 있는 화면(홈·리포트·설정). 폰 프레임은 상위 ShellLayout이 담당.
export default function Layout() {
  return (
    <>
      <main className="app-main">
        <Outlet />
      </main>
      <TabBar />
    </>
  )
}
