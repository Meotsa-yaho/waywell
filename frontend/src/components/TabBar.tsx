import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Search, BarChart3, Settings, Bus } from 'lucide-react';

export default function TabBar() {
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme_dark_mode');
      if (saved !== null) return saved === 'true';
      if (window.matchMedia) return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const isTripActive = Boolean(
    typeof window !== 'undefined' && localStorage.getItem('active_trip_id')
  ) || location.pathname === '/trip';

  // Listen to custom theme events or storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('theme_dark_mode');
      if (saved !== null) setIsDarkMode(saved === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('theme-change', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('theme-change', handleStorageChange);
    };
  }, []);

  return (
    <nav
      id="bottom-nav-bar"
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 max-w-[480px] w-full backdrop-blur-md border-t z-40 px-6 py-2 flex items-center justify-around shadow-lg transition-colors ${
        isDarkMode
          ? 'bg-slate-950/95 border-slate-800 text-slate-400'
          : 'bg-white/95 border-slate-200/90 text-slate-600'
      }`}
    >
      {/* Tab 1: Home / Trip Active */}
      <NavLink
        id="nav-tab-home"
        to="/"
        end
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-1 transition-all relative py-1 px-3 no-underline ${
            isActive
              ? 'text-emerald-500 font-bold scale-105'
              : isDarkMode
              ? 'text-slate-400 hover:text-slate-200 font-medium'
              : 'text-slate-400 hover:text-slate-700 font-medium'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <div className="relative">
              {isTripActive ? (
                <Bus className={`w-5 h-5 ${isActive ? 'text-emerald-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              ) : (
                <Search className="w-5 h-5" />
              )}
              {isTripActive && (
                <span className="absolute -top-1 -right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <span className="text-[11px]">
              {isTripActive ? '이동 중' : '홈 / 검색'}
            </span>
          </>
        )}
      </NavLink>

      {/* Tab 2: Report */}
      <NavLink
        id="nav-tab-report"
        to="/report"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-1 transition-all py-1 px-3 no-underline ${
            isActive
              ? 'text-emerald-500 font-bold scale-105'
              : isDarkMode
              ? 'text-slate-400 hover:text-slate-200 font-medium'
              : 'text-slate-400 hover:text-slate-700 font-medium'
          }`
        }
      >
        <BarChart3 className="w-5 h-5" />
        <span className="text-[11px]">리포트</span>
      </NavLink>

      {/* Tab 3: Settings */}
      <NavLink
        id="nav-tab-settings"
        to="/settings"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-1 transition-all py-1 px-3 no-underline ${
            isActive
              ? 'text-emerald-500 font-bold scale-105'
              : isDarkMode
              ? 'text-slate-400 hover:text-slate-200 font-medium'
              : 'text-slate-400 hover:text-slate-700 font-medium'
          }`
        }
      >
        <Settings className="w-5 h-5" />
        <span className="text-[11px]">설정</span>
      </NavLink>
    </nav>
  );
}
