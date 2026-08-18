import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  User, 
  Sun, 
  Moon, 
  Thermometer, 
  Wind, 
  Scale, 
  Smartphone, 
  Check, 
  RotateCcw, 
  Sparkles, 
  ChevronRight, 
  Database, 
  FileText, 
  Shield, 
  Users,
  LogOut,
  Trash2
} from 'lucide-react';
import { useSession } from '../store/session';
import { api } from '../api/client';
import { startKakaoLogin } from '../lib/kakaoAuth';
import { useCanInstall, promptInstall, isStandalone } from '../lib/pwaInstall';
import { SettingsInfoModal } from '../components/SettingsInfoModal';
import type { SettingsInfoType } from '../components/SettingsInfoModal';
import type { Preset } from '../types/api';

const PRESET_OPTIONS: { 
  id: Preset; 
  title: string; 
  subtitle: string; 
  icon: React.ReactNode; 
  weightText: string;
}[] = [
  {
    id: 'skin',
    title: '피부·자외선 민감형',
    subtitle: '직사광선 야외 대기 및 자외선 지수 집중 회피',
    icon: <Sun className="w-4 h-4 text-amber-500" />,
    weightText: 'UV 가중치 60%',
  },
  {
    id: 'heat',
    title: '더위·추위 온도 민감형',
    subtitle: '폭염·한파 시 에어컨/난방 실내 환승 구역 우선 추천',
    icon: <Thermometer className="w-4 h-4 text-rose-500" />,
    weightText: '온도 가중치 60%',
  },
  {
    id: 'respiratory',
    title: '호흡기·미세먼지 안심형',
    subtitle: '차도변 매연 및 미세먼지 노출 구간 최소화',
    icon: <Wind className="w-4 h-4 text-emerald-500" />,
    weightText: '공기질 가중치 60%',
  },
  {
    id: 'normal',
    title: '일반·스마트 밸런스',
    subtitle: '이동 소요 시간과 환경 스트레스의 균형 최적화',
    icon: <Scale className="w-4 h-4 text-teal-600" />,
    weightText: '균등 가중치 33%',
  },
];

const getSystemDarkModePreference = (): boolean => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('theme_dark_mode');
    if (saved !== null) return saved === 'true';
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }
  return false;
};

export default function Settings() {
  const nav = useNavigate();
  const preset = useSession((s) => s.preset);
  const setPreset = useSession((s) => s.setPreset);
  const token = useSession((s) => s.token);
  const logout = useSession((s) => s.logout);
  const isGuest = !token;

  const canInstall = useCanInstall();
  const installed = isStandalone();

  const [activeInfoModal, setActiveInfoModal] = useState<SettingsInfoType | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(getSystemDarkModePreference);
  const [hasManualDarkModeToggle, setHasManualDarkModeToggle] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('theme_dark_mode') !== null;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (!hasManualDarkModeToggle) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [hasManualDarkModeToggle]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleToggleDarkMode = () => {
    setHasManualDarkModeToggle(true);
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme_dark_mode', String(next));
      window.dispatchEvent(new Event('theme-change'));
      showToast(next ? '🌙 다크 모드가 적용되었습니다.' : '☀️ 라이트 모드가 적용되었습니다.');
      return next;
    });
  };

  const handleChangePreset = (newPreset: Preset) => {
    setPreset(newPreset);
    if (token) {
      api.patchMe(newPreset).catch(() => {});
    }
    const option = PRESET_OPTIONS.find((o) => o.id === newPreset);
    showToast(`'${option?.title || newPreset}' 프리셋으로 변경되었습니다.`);
  };

  const handleKakaoLogin = () => {
    startKakaoLogin();
  };

  const handleLogout = () => {
    logout();
    showToast('로그아웃되었습니다. 게스트 모드로 전환합니다.');
  };

  const handleWithdraw = () => {
    if (!window.confirm('회원 탈퇴 시 계정과 모든 이동 기록이 삭제됩니다. 진행할까요?')) return;
    api.deleteMe().catch(() => {}).finally(() => {
      logout();
      showToast('회원 탈퇴가 완료되었습니다.');
    });
  };

  const handlePwaInstall = () => {
    if (canInstall) {
      promptInstall();
    } else if (installed) {
      showToast('이미 앱으로 설치되어 있습니다.');
    } else {
      showToast('📲 브라우저 메뉴의 "홈 화면에 추가"를 눌러주세요.');
    }
  };

  return (
    <div className={`min-h-full pb-20 p-4 sm:p-5 font-sans transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Toast Notification Popup */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto bg-slate-900/95 text-white text-xs font-medium px-4 py-3 rounded-2xl shadow-xl flex items-center justify-center text-center backdrop-blur-xs border border-slate-700/50"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        key="tab-settings"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        {/* Header with Dark Mode Switch on Top Right */}
        <div className="flex items-center justify-between py-1">
          <div>
            <h1 className={`text-base sm:text-lg font-bold tracking-tight flex items-center gap-1.5 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              <SettingsIcon className="w-4 h-4 text-emerald-500" />
              <span>환경 설정 및 프로필</span>
            </h1>
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              내 계정 및 경로 노출 부하 알고리즘 맞춤 조정
            </p>
          </div>

          {/* Dark Mode Switch */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] font-semibold hidden sm:inline ${
              isDarkMode ? 'text-slate-300' : 'text-slate-600'
            }`}>
              {isDarkMode ? '다크' : '라이트'}
            </span>
            <button
              id="btn-darkmode-toggle"
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              onClick={handleToggleDarkMode}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
                isDarkMode ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              <span className="sr-only">다크모드 스위치</span>
              <span
                className={`pointer-events-none flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transform ring-0 transition duration-200 ease-in-out ${
                  isDarkMode ? 'translate-x-5 text-emerald-700' : 'translate-x-0 text-slate-500'
                }`}
              >
                {isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              </span>
            </button>
          </div>
        </div>

        {/* Account Section */}
        <div className={`rounded-2xl p-4 border shadow-xs transition-colors ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80'
        }`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${
            isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            계정 상태
          </span>

          {isGuest ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      게스트 세션 사용 중
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                      isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}>
                      임시
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">기록 영구 저장을 위해 연동을 추천해요</p>
                </div>
              </div>

              <button
                id="btn-settings-kakao-login"
                onClick={handleKakaoLogin}
                style={{ backgroundColor: '#FEE500', color: '#191919' }}
                className="h-9 px-3.5 inline-flex items-center justify-center font-bold text-xs rounded-xl shadow-xs hover:brightness-95 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                카카오 연동
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-900 font-bold text-sm">
                  K
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      카카오 회원 연동됨
                    </span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                      보관 중
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">주간 웰니스 데이터가 안전하게 동기화됩니다</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleLogout}
                  className={`h-9 px-3 inline-flex items-center justify-center gap-1 border font-semibold text-xs rounded-xl transition-all active:scale-95 cursor-pointer ${
                    isDarkMode 
                      ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                  title="로그아웃"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>로그아웃</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preset Radio Cards */}
        <div className={`rounded-2xl p-4 border shadow-xs space-y-2.5 transition-colors ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`}>
              노출 부하 민감도 프리셋
            </span>
            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" />
              실시간 경로 반영
            </span>
          </div>

          <div className="space-y-2">
            {PRESET_OPTIONS.map((opt) => {
              const isSelected = preset === opt.id;

              return (
                <div
                  key={opt.id}
                  onClick={() => handleChangePreset(opt.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? isDarkMode
                        ? 'border-emerald-500 bg-emerald-950/40 shadow-xs'
                        : 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                      : isDarkMode
                      ? 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected 
                          ? isDarkMode ? 'bg-emerald-900/50 shadow-2xs' : 'bg-white shadow-2xs'
                          : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                      }`}
                    >
                      {opt.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {opt.title}
                        </span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                          isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {opt.weightText}
                        </span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {opt.subtitle}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : isDarkMode
                        ? 'border-slate-700 bg-slate-800'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PWA App Install Banner */}
        <div
          onClick={handlePwaInstall}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-3.5 text-white shadow-xs flex items-center justify-between cursor-pointer hover:brightness-105 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold block">홈 화면에 웨이웰 앱 추가</span>
              <span className="text-[10px] text-emerald-100 block">
                {installed ? '이미 앱으로 설치되어 있습니다' : '앱 설치 없이 모바일 바로가기로 빠른 실행'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-200" />
        </div>

        {/* Service & Legal Information Section */}
        <div className={`rounded-2xl p-4 border shadow-xs space-y-2 transition-colors ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80'
        }`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
            isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            서비스 및 법적 정보
          </span>

          <div className={`divide-y text-xs ${isDarkMode ? 'divide-slate-800/80' : 'divide-slate-100'}`}>
            {/* 1. 데이터 출처 */}
            <button
              id="btn-info-sources"
              onClick={() => setActiveInfoModal('sources')}
              className={`w-full py-2.5 px-1 flex items-center justify-between transition-colors cursor-pointer group ${
                isDarkMode ? 'hover:text-emerald-400' : 'hover:text-emerald-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-500" />
                <span className={`font-semibold ${isDarkMode ? 'text-slate-200 group-hover:text-emerald-400' : 'text-slate-700 group-hover:text-emerald-600'}`}>
                  데이터 출처
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>기상청 · 에어코리아 · ODsay 외</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* 2. 이용약관 */}
            <button
              id="btn-info-terms"
              onClick={() => setActiveInfoModal('terms')}
              className={`w-full py-2.5 px-1 flex items-center justify-between transition-colors cursor-pointer group ${
                isDarkMode ? 'hover:text-emerald-400' : 'hover:text-emerald-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-teal-500" />
                <span className={`font-semibold ${isDarkMode ? 'text-slate-200 group-hover:text-emerald-400' : 'text-slate-700 group-hover:text-emerald-600'}`}>
                  이용약관
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>서비스 안내 및 면책</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* 3. 개인정보처리방침 */}
            <button
              id="btn-info-privacy"
              onClick={() => setActiveInfoModal('privacy')}
              className={`w-full py-2.5 px-1 flex items-center justify-between transition-colors cursor-pointer group ${
                isDarkMode ? 'hover:text-emerald-400' : 'hover:text-emerald-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-blue-500" />
                <span className={`font-semibold ${isDarkMode ? 'text-slate-200 group-hover:text-emerald-400' : 'text-slate-700 group-hover:text-emerald-600'}`}>
                  개인정보처리방침
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>데이터 보관 및 파기</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* 4. 만든 사람 */}
            <button
              id="btn-info-team"
              onClick={() => setActiveInfoModal('team')}
              className={`w-full py-2.5 px-1 flex items-center justify-between transition-colors cursor-pointer group ${
                isDarkMode ? 'hover:text-emerald-400' : 'hover:text-emerald-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-amber-500" />
                <span className={`font-semibold ${isDarkMode ? 'text-slate-200 group-hover:text-emerald-400' : 'text-slate-700 group-hover:text-emerald-600'}`}>
                  만든 사람
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>멋사 야호 팀</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>

        {/* Restart Onboarding Button */}
        <button
          onClick={() => nav('/onboarding')}
          className={`w-full py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isDarkMode 
              ? 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200' 
              : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>온보딩 가이드 다시 체험하기</span>
        </button>

        {/* Withdraw Section for logged-in users */}
        {token && (
          <div className="pt-2 text-center">
            <button
              onClick={handleWithdraw}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>회원 탈퇴</span>
            </button>
          </div>
        )}

        <p className={`text-[11px] text-center pt-2 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          웨이웰 v0.1.0
        </p>

        {/* Info Modal */}
        <SettingsInfoModal
          type={activeInfoModal}
          isOpen={Boolean(activeInfoModal)}
          isDarkMode={isDarkMode}
          onClose={() => setActiveInfoModal(null)}
        />
      </motion.div>
    </div>
  );
}
