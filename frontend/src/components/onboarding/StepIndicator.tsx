import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { ProgressiveFluxLoader } from './ui/progressive-flux-loader';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  onBack?: () => void;
  authSuccess?: 'kakao' | 'guest' | null;
}

const ONBOARDING_PHASES = [
  { at: 0, label: '시작하기' },
  { at: 34, label: '맞춤 설정' },
  { at: 67, label: '회원가입' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onBack, authSuccess }) => {
  const steps = [
    { num: 1, label: '시작하기' },
    { num: 2, label: '맞춤 설정' },
    { num: 3, label: '회원가입' },
  ];

  const isAuthCompleted = Boolean(authSuccess);
  const progressPercent = currentStep === 1 ? 33.33 : currentStep === 2 ? 66.66 : isAuthCompleted ? 100 : 92;

  return (
    <header className="w-full mb-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-3.5 h-7">
        <div className="flex items-center gap-2">
          {currentStep > 1 ? (
            <button
              id="back-step-btn"
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-emerald-100/60 active:scale-95 transition-all text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              aria-label="이전 단계로 이동"
            >
              <ArrowLeft className="w-5 h-5 text-emerald-900" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-emerald-900 tracking-wider uppercase">Waywell</span>
            </div>
          )}
        </div>
      </div>

      {/* Progressive Flux Loader Bar with Embedded Step Labels */}
      <ProgressiveFluxLoader
        value={progressPercent}
        phases={ONBOARDING_PHASES}
        showLabel={false}
        gradient="linear-gradient(90deg, #059669 0%, #10b981 45%, #34d399 75%, #059669 100%)"
        barClassName="h-8 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_-1px_2px_rgba(255,255,255,0.8)] border border-emerald-100 bg-slate-100/90"
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
                  <span className="flex items-center gap-1 text-slate-400 font-medium">
                    <Check className="w-3.5 h-3.5 text-slate-300 stroke-[2] shrink-0" />
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
