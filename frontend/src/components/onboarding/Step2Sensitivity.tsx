import React from 'react';
import { motion } from 'motion/react';
import { Check, ArrowRight, SlidersHorizontal } from 'lucide-react';
import type { SensitivityId } from '../../types/onboarding';
import { SENSITIVITY_OPTIONS } from '../../data/onboardingOptions';

interface Step2SensitivityProps {
  selectedSensitivity: SensitivityId;
  onSelect: (id: SensitivityId) => void;
  onNext: () => void;
  onSkip: () => void;
}

export const Step2Sensitivity: React.FC<Step2SensitivityProps> = ({
  selectedSensitivity,
  onSelect,
  onNext,
  onSkip,
}) => {
  return (
    <motion.div
      key="step-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col justify-between"
    >
      {/* Header */}
      <div className="space-y-1.5">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold bg-emerald-50 border-emerald-200/70 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-300`}>
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
          <span>개인화 노출 부하 프로필</span>
        </div>
        <h1 className={`text-xl sm:text-2xl font-bold leading-tight tracking-tight text-emerald-900 dark:text-white`}>
          출퇴근길, 가장 피하고<br />
          <span className="text-emerald-700 dark:text-emerald-400">싶은 상황을 골라주세요!</span>
        </h1>
        <p className={`text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400`}>
          선택한 설정에 따라 맞춤형 경로 가중치가 적용됩니다.
        </p>
      </div>

      {/* Sensitivity Cards Selection */}
      <div className="my-4 space-y-2.5">
        {SENSITIVITY_OPTIONS.map((option) => {
          const isSelected = selectedSensitivity === option.id;

          return (
            <div
              key={option.id}
              id={`sensitivity-option-${option.id}`}
              onClick={() => onSelect(option.id)}
              className={`p-3 rounded-2xl cursor-pointer transition-all duration-200 flex items-center justify-between gap-3 text-left ${
                isSelected
                  ? 'border-2 border-emerald-500 bg-emerald-50 shadow-xs dark:bg-emerald-950/40'
                  : 'border border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Icon Circle */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-white shadow-xs dark:bg-emerald-900/60'
                      : 'bg-slate-50 dark:bg-slate-800'
                  }`}
                >
                  <span>{option.icon}</span>
                </div>

                {/* Content */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2
                      className={`text-xs sm:text-sm font-bold truncate ${
                        isSelected
                          ? 'text-emerald-950 dark:text-white'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {option.title}
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {option.category} • {option.tag}
                  </p>
                </div>
              </div>

              {/* Radio Check Indicator */}
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Dual Action Buttons */}
      <div className="pt-2 space-y-2">
        <div className="flex gap-3">
          {/* Skip Button */}
          <button
            id="step2-skip-btn"
            onClick={onSkip}
            className={`flex-1 py-3.5 font-bold rounded-xl text-xs transition-all cursor-pointer text-center focus:outline-none focus:ring-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 focus:ring-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600 dark:text-slate-300 dark:focus:ring-slate-700`}
          >
            건너뛰기
          </button>

          {/* Next Button */}
          <button
            id="step2-next-btn"
            onClick={onNext}
            className={`flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.99] shadow-emerald-200 dark:shadow-emerald-950/50`}
          >
            <span>다음 단계로</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          건너뛰기를 누르면 기본 '스마트 밸런스' 프로필로 자동 설정됩니다
        </p>
      </div>
    </motion.div>
  );
};
