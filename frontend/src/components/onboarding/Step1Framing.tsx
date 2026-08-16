import React from 'react';
import { motion } from 'motion/react';
import { 
  Sun, 
  Thermometer, 
  Check, 
  ArrowRight, 
  Coffee, 
  Wind,
  HeartHandshake
} from 'lucide-react';

interface Step1FramingProps {
  onNext: () => void;
}

export const Step1Framing: React.FC<Step1FramingProps> = ({ onNext }) => {
  return (
    <motion.div
      key="step-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col justify-between"
    >
      {/* Title & Subtitle Section */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-[11px] font-bold">
          <HeartHandshake className="w-3.5 h-3.5 text-emerald-600" />
          <span>신체 피로를 줄이는 웰니스 내비게이션</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-emerald-950 leading-tight tracking-tight">
          오늘 당신의 출퇴근길,<br />
          <span className="text-emerald-800">피부와 몸은 괜찮았나요?</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          최단 시간이 아닌, <strong className="text-slate-700 font-semibold">'신체 부담이 가장 적은 길'</strong>로 안내합니다.
        </p>
      </div>

      {/* Main Comparison Visual Cards */}
      <div className="my-5 space-y-3.5">
        {/* 1. Traditional Map Card (Danger / Gray-Red) */}
        <div 
          id="traditional-route-card"
          className="p-3.5 border border-slate-100 rounded-2xl bg-slate-50 opacity-75 hover:opacity-100 transition-opacity"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              기존 지도 서비스 (최단시간)
            </span>
            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded-full">
              DANGER
            </span>
          </div>

          <div className="flex items-center gap-2 mb-1.5">
            <Sun className="w-4 h-4 text-rose-500 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800">
              뙤약볕 정류장 25분 대기
            </h2>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
            <span className="flex items-center gap-1 text-rose-600 font-medium">
              <Thermometer className="w-3.5 h-3.5" /> 체감 온도 34℃
            </span>
            <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
              노출 부하 85점
            </span>
          </div>
        </div>

        {/* 2. Waywell Card (Safe / Natural Emerald Tones) */}
        <div 
          id="waywell-route-card"
          className="p-4 border-2 border-emerald-500 rounded-2xl bg-emerald-50 shadow-sm relative transition-all"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              웨이웰 추천 경로
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full text-center shadow-xs">
              SAFE
            </span>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <Coffee className="w-4 h-4 text-emerald-600 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-emerald-950">
              실내 카페 대기 + 이동 3분
            </h2>
          </div>

          <div className="flex items-center justify-between text-xs text-emerald-700 pt-1.5 border-t border-emerald-200/60 font-medium">
            <span className="flex items-center gap-1 text-emerald-800">
              <Wind className="w-3.5 h-3.5 text-emerald-600" /> 실내 24℃ 냉방 쉘터
            </span>
            <span className="font-bold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded">
              노출 부하 28점 (최저 수준)
            </span>
          </div>

          {/* Floating Check Badge */}
          <div className="absolute -right-2 -top-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs shadow-md">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        </div>
      </div>

      {/* Bottom CTA Button */}
      <div className="pt-2">
        <button
          id="step1-cta-button"
          onClick={onNext}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-2xl text-sm shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.99]"
        >
          <span>나만의 맞춤 케어 설정하기</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-center text-[11px] text-slate-400 mt-2.5">
          평균 이동 시간 차이는 단 2~4분, 신체 피로도는 최대 70% 감소합니다
        </p>
      </div>
    </motion.div>
  );
};
