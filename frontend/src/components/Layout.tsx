import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

export default function Layout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
