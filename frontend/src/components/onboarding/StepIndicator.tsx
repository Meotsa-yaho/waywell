import React from 'react';
import { ArrowLeft, Check, Sun, Moon } from 'lucide-react';
import { ProgressiveFluxLoader } from './ui/progressive-flux-loader';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  onBack?: () => void;
  authSuccess?: 'kakao' | 'guest' | null;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const ONBOARDING_PHASES = [
  { at: 0, label: '시작하기' },
  { at: 34, label: '맞춤 설정' },
  { at: 67, label: '회원가입' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ 
  currentStep, 
  onBack, 
  authSuccess,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const steps = [
    { num: 1, label: '시작하기' },
    { num: 2, label: '맞춤 설정' },
    { num: 3, label: '회원가입' },
  ];

  const isAuthCompleted = Boolean(authSuccess);
  const progressPercent = currentStep === 1 ? 33.33 : currentStep === 2 ? 66.66 : isAuthCompleted ? 100 : 92;

  return (
    <header className="w-full mb-6">
      {/* Top Header Bar with Dark Mode Switch on Top Right */}
      <div className="flex items-center justify-between mb-3.5 h-7">
        <div className="flex items-center gap-2">
          {currentStep > 1 ? (
            <button
              id="back-step-btn"
              onClick={onBack}
              className={`p-1.5 -ml-1.5 rounded-full active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                isDarkMode 
                  ? 'hover:bg-slate-800 text-slate-300' 
                  : 'hover:bg-emerald-100/60 text-emerald-900'
              }`}
              aria-label="이전 단계로 이동"
            >
              <ArrowLeft className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-emerald-900'}`} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className={`text-xs font-bold tracking-wider uppercase ${isDarkMode ? 'text-emerald-400' : 'text-emerald-900'}`}>
                Waywell
              </span>
            </div>
          )}
        </div>

        {/* Dark Mode Switch on Top Right */}
        {onToggleDarkMode && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] font-semibold hidden sm:inline ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {isDarkMode ? '다크' : '라이트'}
            </span>
            <button
              id="btn-onboarding-darkmode-toggle"
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              onClick={onToggleDarkMode}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
                isDarkMode ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              <span className="sr-only">다크모드 스위치</span>
              <span
                className={`pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transform ring-0 transition duration-200 ease-in-out ${
                  isDarkMode ? 'translate-x-5 text-emerald-700' : 'translate-x-0 text-slate-500'
                }`}
              >
                {isDarkMode ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Progressive Flux Loader Bar with Embedded Step Labels */}
      <ProgressiveFluxLoader
        value={progressPercent}
        phases={ONBOARDING_PHASES}
        showLabel={false}
        gradient="linear-gradient(90deg, #059669 0%, #10b981 45%, #34d399 75%, #059669 100%)"
        barClassName={`h-8 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.8)] border transition-colors ${
          isDarkMode 
            ? 'border-slate-800 bg-slate-900' 
            : 'border-emerald-100 bg-slate-100/90'
        }`}
      >
        {/* Overlay grid inside progress bar */}
        <div className="absolute inset-0 grid grid-cols-3 z-10 pointer-events-none">
          {steps.map((s) => {
            const isStep3Completed = s.num === 3 && isAuthCompleted;
            const isPassed = s.num < currentStep || isStep3Completed;
            const isActive = s.num === currentStep && !isStep3Completed;

            return (
              <div
                key={s.num}
                className="flex items-center justify-center gap-1 px-1 text-[11px] font-bold transition-colors duration-300 select-none"
              >
                {isPassed ? (
                  <span className="flex items-center gap-1 text-emerald-950 font-extrabold drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]">
                    <Check className="w-3.5 h-3.5 text-emerald-950 stroke-[3.5] shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </span>
                ) : isActive ? (
                  <span className="flex items-center gap-1 text-white font-extrabold drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                    <Check className="w-3.5 h-3.5 text-white/90 stroke-[2.5] shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </span>
                ) : (
                  <span className={`flex items-center gap-1 font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 stroke-[2] shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                    <span className="truncate">{s.label}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </ProgressiveFluxLoader>
    </header>
  );
};
