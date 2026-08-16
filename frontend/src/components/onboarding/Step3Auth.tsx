import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Bell, ChevronRight, ShieldCheck, Check, Loader2 } from 'lucide-react';
import type { SensitivityId } from '../../types/onboarding';
import { SENSITIVITY_OPTIONS } from '../../data/onboardingOptions';

interface Step3AuthProps {
  selectedSensitivity: SensitivityId;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onLoginKakao: () => void;
  onEnterGuest: () => void;
  authSuccess: 'kakao' | 'guest' | null;
  isKakaoLoading: boolean;
}

export const Step3Auth: React.FC<Step3AuthProps> = ({
  selectedSensitivity,
  notificationsEnabled,
  onToggleNotifications,
  onLoginKakao,
  onEnterGuest,
  authSuccess,
  isKakaoLoading,
}) => {
  const currentOption = SENSITIVITY_OPTIONS.find((opt) => opt.id === selectedSensitivity) || SENSITIVITY_OPTIONS[3];

  return (
    <motion.div
      key="step-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col justify-between"
    >
      {/* Title Section */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-[11px] font-bold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>온보딩 마지막 단계</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold leading-tight text-emerald-900 tracking-tight">
          노출 부하 프로필이<br />
          <span className="text-emerald-700">완성되었습니다!</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          지정한 맞춤 설정으로 오늘 이동의 신체 부담을 줄여드릴게요.
        </p>
      </div>

      {/* Middle Content - Natural Tones Style */}
      <div className="my-4 space-y-3">
        {/* Verified Profile Card */}
        <div 
          id="profile-summary-card"
          className="bg-emerald-50 rounded-3xl p-5 text-center border border-emerald-100/90 shadow-xs"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full mx-auto mb-2.5 flex items-center justify-center text-2xl sm:text-3xl shadow-sm">
            {currentOption.icon}
          </div>
          <div className="inline-flex items-center gap-1 px-3 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full mb-1.5 uppercase tracking-wide shadow-xs">
            <ShieldCheck className="w-3 h-3" />
            <span>Verified Profile</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-emerald-950">
            {currentOption.tag} 적용됨
          </div>
          <p className="text-[11px] text-emerald-800/80 mt-1 font-medium">
            "{currentOption.title}"
          </p>
        </div>

        {/* PWA Notification Toggle Card */}
        <div 
          id="pwa-notification-toggle-card"
          onClick={onToggleNotifications}
          className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-2xl cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-700 tracking-tight block">
                실내 대기 중 버스 도착 3분 전 알림 받기
              </span>
              <span className="text-[10px] text-slate-400 block">
                정류장에서 서서 대기하지 않도록 출발 시점 안내
              </span>
            </div>
          </div>

          {/* Toggle Switch */}
          <div
            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
              notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Two-Track Action Buttons - Natural Tones styling */}
      <div className="pt-2 space-y-2">
        {/* Track 1: Kakao Login Button with Loading State */}
        <div>
          <button
            id="kakao-login-button"
            onClick={onLoginKakao}
            disabled={isKakaoLoading || authSuccess === 'kakao'}
            style={{ backgroundColor: '#FEE500', color: '#191919' }}
            className={`w-full py-3.5 px-4 font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              isKakaoLoading
                ? 'opacity-80 cursor-wait'
                : authSuccess === 'kakao'
                ? 'brightness-95 cursor-default'
                : 'hover:brightness-95 active:scale-[0.99]'
            }`}
          >
            {isKakaoLoading ? (
              <div className="flex items-center gap-2 text-neutral-900 font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-800" />
                <span>카카오 계정 연동 확인 중...</span>
              </div>
            ) : authSuccess === 'kakao' ? (
              <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
                <Check className="w-4 h-4 stroke-[3] text-emerald-700" />
                <span>카카오 연동 완료</span>
              </div>
            ) : (
              <>
                <svg
                  className="w-4 h-4 fill-current shrink-0"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 3C6.477 3 2 6.477 2 10.768c0 2.76 1.84 5.187 4.636 6.54l-.946 3.492c-.083.307.247.558.508.389l4.137-2.736c.54.077 1.096.118 1.665.118 5.523 0 10-3.477 10-7.803C22 6.477 17.523 3 12 3z" />
                </svg>
                <span>카카오로 3초 만에 시작하기</span>
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-1">
            기기 변경 시에도 내 프로필이 안전하게 저장돼요.
          </p>
        </div>

        {/* Track 2: Guest Exploration Button */}
        <div>
          <button
            id="guest-enter-button"
            onClick={onEnterGuest}
            disabled={isKakaoLoading}
            className={`w-full py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-slate-300 ${
              isKakaoLoading
                ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400'
                : authSuccess === 'guest'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
            }`}
          >
            {authSuccess === 'guest' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span>게스트 프로필 설정 완료</span>
              </>
            ) : (
              <>
                <span>로그인 없이 게스트로 바로 둘러보기</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
