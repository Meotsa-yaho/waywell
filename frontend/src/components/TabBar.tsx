import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: '홈', icon: '🏠', end: true },
  { to: '/report', label: '리포트', icon: '📊', end: false },
  { to: '/settings', label: '설정', icon: '⚙️', end: false },
]

export default function TabBar() {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => 'tab' + (isActive ? ' tab--active' : '')}
        >
          <span className="tab__icon">{t.icon}</span>
          <span className="tab__label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
