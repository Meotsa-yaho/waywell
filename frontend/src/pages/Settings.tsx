import React, { useState } from 'react';
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
import { useTheme } from '../store/theme';
import { useSession } from '../store/session';
import { useRouteQuery } from '../store/route';
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

export default function Settings() {
  const nav = useNavigate();
  const preset = useSession((s) => s.preset);
  const setPreset = useSession((s) => s.setPreset);
  const token = useSession((s) => s.token);
  const logout = useSession((s) => s.logout);
  const startDemoSession = useRouteQuery((s) => s.startDemoSession);
  const isGuest = !token;

  const canInstall = useCanInstall();
  const installed = isStandalone();

  const [activeInfoModal, setActiveInfoModal] = useState<SettingsInfoType | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [profileClickCount, setProfileClickCount] = useState<number>(0);
  const isDemoMode = profileClickCount >= 5;

  const isDarkMode = useTheme((s) => s.isDark);
  const setDark = useTheme((s) => s.setDark);

  const handleProfileClick = () => {
    setProfileClickCount((prev) => {
      const next = prev + 1;
      if (next === 5) {
        showToast('🚀 데모 시연 모드가 활성화되었습니다.');
      }
      return next;
    });
  };

  const handleStartDemo = () => {
    startDemoSession();
    showToast('🚀 데모 시연 모드로 진입합니다.');
    setTimeout(() => {
      nav('/');
    }, 250);
  };


  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleToggleDarkMode = () => {
    const next = !isDarkMode;
    setDark(next);
    showToast(next ? '다크 모드로 전환했어요.' : '라이트 모드로 전환했어요.');
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
    <div className={`min-h-full pb-20 p-4 sm:p-5 font-sans transition-colors duration-200 bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100`}>
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
            <h1 className={`text-base sm:text-lg font-bold tracking-tight flex items-center gap-1.5 text-slate-900 dark:text-white`}>
              <SettingsIcon className="w-4 h-4 text-emerald-500" />
              <span>환경 설정 및 프로필</span>
            </h1>
            <p className={`text-[11px] text-slate-500 dark:text-slate-400`}>
              내 계정 및 경로 노출 부하 알고리즘 맞춤 조정
            </p>
          </div>

          {/* Dark Mode Switch */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] font-semibold hidden sm:inline text-slate-600 dark:text-slate-300`}>
              "라이트 dark:다크"
            </span>
            <button
              id="btn-darkmode-toggle"
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              onClick={handleToggleDarkMode}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none bg-slate-300 dark:bg-emerald-600`}
              title="다크 모드로 전환 dark:라이트 dark:모드로 dark:전환"
            >
              <span className="sr-only">다크모드 스위치</span>
              <span
                className={`pointer-events-none flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transform ring-0 transition duration-200 ease-in-out translate-x-0 text-slate-500 dark:translate-x-5 dark:text-emerald-700`}
              >
                {isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              </span>
            </button>
          </div>
        </div>

        {/* Account Section */}
        <div className={`rounded-2xl p-4 border shadow-xs transition-colors bg-white border-slate-200/80 dark:bg-slate-900/90 dark:border-slate-800`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider block mb-2 text-slate-400 dark:text-slate-500`}>
            계정 상태
          </span>

          {isGuest ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  onClick={handleProfileClick}
                  className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer select-none active:scale-95 transition-transform bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`}
                  title="프로필"
                >
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold text-slate-900 dark:text-white`}>
                      게스트 세션 사용 중
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>
                      임시
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">기록 영구 저장을 위해 연동을 추천해요</p>
                </div>
              </div>

              {isDemoMode ? (
                <button
                  id="btn-settings-demo-mode"
                  onClick={handleStartDemo}
                  className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 font-bold text-xs rounded-xl shadow-xs bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>데모 시연</span>
                </button>
              ) : (
                <button
                  id="btn-settings-kakao-login"
                  onClick={handleKakaoLogin}
                  style={{ backgroundColor: '#FEE500', color: '#191919' }}
                  className="h-9 px-3.5 inline-flex items-center justify-center font-bold text-xs rounded-xl shadow-xs hover:brightness-95 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  카카오 연동
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  onClick={handleProfileClick}
                  className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-900 font-bold text-sm cursor-pointer select-none active:scale-95 transition-transform"
                  title="프로필"
                >
                  K
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold text-slate-900 dark:text-white`}>
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
                {isDemoMode && (
                  <button
                    id="btn-settings-demo-mode-auth"
                    onClick={handleStartDemo}
                    className="h-9 px-3 inline-flex items-center justify-center gap-1 font-bold text-xs rounded-xl shadow-xs bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>데모 시연</span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className={`h-9 px-3 inline-flex items-center justify-center gap-1 border font-semibold text-xs rounded-xl transition-all active:scale-95 cursor-pointer border-slate-200 hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200`}
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
        <div className={`rounded-2xl p-4 border shadow-xs space-y-2.5 transition-colors bg-white border-slate-200/80 dark:bg-slate-900/90 dark:border-slate-800`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500`}>
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
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-xs dark:bg-emerald-950/40'
                      : 'border-slate-200 hover:border-slate-300 bg-white dark:border-slate-800 dark:hover:border-slate-700 dark:bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? 'bg-white shadow-2xs dark:bg-emerald-900/50'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {opt.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold text-slate-900 dark:text-white`}>
                          {opt.title}
                        </span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`}>
                          {opt.weightText}
                        </span>
                      </div>
                      <p className={`text-[10px] mt-0.5 text-slate-500 dark:text-slate-400`}>
                        {opt.subtitle}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800'
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
        <div className={`rounded-2xl p-4 border shadow-xs space-y-2 transition-colors bg-white border-slate-200/80 dark:bg-slate-900/90 dark:border-slate-800`}>
          <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 text-slate-400 dark:text-slate-500`}>
            서비스 및 법적 정보
          </span>

          <div className={`divide-y text-xs divide-slate-100 dark:divide-slate-800/80`}>
            {/* 1. 데이터 출처 */}
            <button
              id="btn-info-sources"
              onClick={() => setActiveInfoModal('sources')}
              className={`w-full py-2.5 px-1 flex items-center justify-between transition-colors cursor-pointer group hover:text-emerald-600 dark:hover:text-emerald-400`}
            >
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-500" />
                <span className={`font-semibold text-slate-700 group-hover:text-emerald-600 dark:text-slate-200 dark:group-hover:text-emerald-400`}>
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
              className={`w-full py-2.5 px-1 flex items-center justify-between transition-colors cursor-pointer group hover:text-emerald-600 dark:hover:text-emerald-400`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-teal-500" />
                <span className={`font-semibold text-slate-700 group-hover:text-emerald-600 dark:text-slate-200 dark:group-hover:text-emerald-400`}>
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
              className={`w-full py-2.5 px-1 flex items-center justify-between transition-colors cursor-pointer group hover:text-emerald-600 dark:hover:text-emerald-400`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-blue-500" />
                <span className={`font-semibold text-slate-700 group-hover:text-emerald-600 dark:text-slate-200 dark:group-hover:text-emerald-400`}>
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
              className={`w-full py-2.5 px-1 flex items-center justify-between transition-colors cursor-pointer group hover:text-emerald-600 dark:hover:text-emerald-400`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-amber-500" />
                <span className={`font-semibold text-slate-700 group-hover:text-emerald-600 dark:text-slate-200 dark:group-hover:text-emerald-400`}>
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
          className={`w-full py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200`}
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

        <p className={`text-[11px] text-center pt-2 text-slate-400 dark:text-slate-600`}>
          웨이웰 v0.1.0
        </p>

        {/* Info Modal */}
        <SettingsInfoModal
          type={activeInfoModal}
          isOpen={Boolean(activeInfoModal)}
          onClose={() => setActiveInfoModal(null)}
        />
      </motion.div>
    </div>
  );
}
