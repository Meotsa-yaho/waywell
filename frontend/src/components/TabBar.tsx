import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Search, BarChart3, Settings as SettingsIcon, Bus } from 'lucide-react';

// 하단 3탭. 이동 중이면 홈 탭이 '이동 중'으로 바뀐다.
export default function TabBar() {
  const location = useLocation();
  const [tripId, setTripId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('active_trip_id') : null
  );

  // 이동 시작/완료는 다른 화면에서 일어남 → 포커스 복귀 때 재확인
  useEffect(() => {
    const sync = () => setTripId(localStorage.getItem('active_trip_id'));
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, [location.pathname]);

  const isTripActive = Boolean(tripId) || location.pathname === '/trip';

  const tabs = [
    {
      to: '/',
      end: true,
      label: isTripActive ? '이동 중' : '홈 / 검색',
      Icon: isTripActive ? Bus : Search,
      live: isTripActive,
    },
    { to: '/report', end: false, label: '리포트', Icon: BarChart3, live: false },
    { to: '/settings', end: false, label: '설정', Icon: SettingsIcon, live: false },
  ];

  return (
    <nav
      id="bottom-nav-bar"
      aria-label="주요 메뉴"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px]
                 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur-md
                 shadow-[var(--shadow-lg)]
                 flex items-stretch justify-around
                 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {tabs.map(({ to, end, label, Icon, live }) => (
        <NavLink
          key={to}
          id={`nav-tab-${to === '/' ? 'home' : to.slice(1)}`}
          to={to}
          end={end}
          className={({ isActive }) =>
            `relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--r-sm)]
             px-2 py-1.5 no-underline transition-colors
             ${isActive
               ? 'text-[var(--brand)] font-semibold'
               : 'text-[var(--muted)] font-medium hover:text-[var(--ink-soft)]'}`
          }
        >
          {({ isActive }) => (
            <>
              {/* 글자 확대 대신 상단 바로 표시 (전환 때 안 흔들림) */}
              <span
                aria-hidden
                className={`absolute -top-1 h-0.5 w-8 rounded-full transition-opacity
                            ${isActive ? 'bg-[var(--brand)] opacity-100' : 'opacity-0'}`}
              />
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                {live && (
                  <span className="absolute -right-2 -top-1 flex h-2 w-2" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
                  </span>
                )}
              </span>
              <span className="text-[11px] leading-none">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
