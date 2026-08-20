import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Calendar,
  TrendingDown,
  TrendingUp,
  Clock,
  Zap,
  ShieldCheck,
  Sparkles,
  Lock,
  ChevronRight,
  RefreshCw,
  Sun
} from 'lucide-react';
import { api } from '../api/client';
import { startKakaoLogin } from '../lib/kakaoAuth';
import EmptyState from '../components/EmptyState';
import type { WeeklyReport } from '../types/api';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function Report() {
  const nav = useNavigate();
  const [data, setData] = useState<WeeklyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadReport = () => {
    setLoading(true);
    setFailed(false);
    api.getWeeklyReport()
      .then((res) => {
        setData(res);
        setFailed(false);
      })
      .catch(() => {
        setFailed(true);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadReport();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const maxScore = data?.has_data ? Math.max(...data.daily.map((d) => d.exposure_load), 50) : 50;

  const weeklyChartData = data?.has_data
    ? data.daily.map((d) => {
        const dateObj = new Date(d.date);
        const dayName = DAY_NAMES[dateObj.getDay()] || d.date.slice(5);
        const isToday = d.date === todayStr;
        return {
          day: dayName,
          date: d.date.slice(5),
          score: d.exposure_load,
          outdoorMin: d.outdoor_minutes,
          isToday,
        };
      })
    : [];

  const totalOutdoorMin = data?.has_data ? data.daily.reduce((acc, cur) => acc + cur.outdoor_minutes, 0) : 0;
  const avgOutdoorMin = data?.has_data && data.daily.length > 0 ? Math.round(totalOutdoorMin / data.daily.length) : 0;
  const loadChangePct = data?.has_data ? data.comparison.exposure_load_change_pct : null;

  return (
    <div
      className={`min-h-full pb-20 p-4 sm:p-5 font-sans transition-colors duration-200 bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100`}
    >
      <motion.div
        key="tab-report"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        {/* Header with Comparison Badge */}
        <div className="flex items-center justify-between py-1">
          <div>
            <h1
              className={`text-base sm:text-lg font-bold tracking-tight flex items-center gap-1.5 text-slate-900 dark:text-white`}
            >
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>주간 웰니스 이동 리포트</span>
            </h1>
            <p className={`text-[11px] text-slate-500 dark:text-slate-400`}>
              최근 7일간의 신체 노출 부하 방어 성과
            </p>
          </div>

          {data?.has_data && loadChangePct !== null && (
            <div
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                loadChangePct <= 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60'
                  : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800/60'
              }`}
            >
              {loadChangePct <= 0 ? (
                <>
                  <TrendingDown className="w-3 h-3 text-emerald-500" />
                  <span>전주 대비 {Math.abs(loadChangePct)}% 개선</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3 text-rose-500" />
                  <span>전주 대비 +{loadChangePct}%</span>
                </>
              )}
            </div>
          )}
        </div>

        {failed ? (
          <div className="py-6">
            <EmptyState
              icon="📡"
              title="리포트를 불러오지 못했어요"
              hint="네트워크 상태를 확인해주세요."
              actionLabel="다시 시도"
              onAction={loadReport}
            />
          </div>
        ) : loading || !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
              <p className={`text-xs font-medium text-slate-500 dark:text-slate-400`}>
                주간 웰니스 리포트 계산 중...
              </p>
            </div>
          </div>
        ) : !data.has_data ? (
          <div className="pt-6">
            <EmptyState
              icon="🚶"
              title="아직 이동 기록이 없어요"
              hint="첫 이동을 완료하면 주간 노출 부하와 방어 성과가 여기에 기록돼요."
              actionLabel="경로 찾기"
              onAction={() => nav('/')}
            />
          </div>
        ) : (
          <>

        {/* 3 Summary Stat Cards */}
        <div className="grid grid-cols-3 gap-2">
          {/* Outdoor Exposure */}
          <div className={`rounded-2xl p-3 border shadow-xs text-center transition-colors bg-white border-slate-200/80 text-slate-900 dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100`}>
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium">야외 노출</span>
            </div>
            <div className={`text-base sm:text-lg font-black text-slate-900 dark:text-white`}>
              {data.today.outdoor_minutes}<span className="text-xs font-semibold text-slate-400">분</span>
            </div>
            <span className="text-[9px] text-emerald-500 font-bold block mt-0.5">
              하루 평균 {avgOutdoorMin}분
            </span>
          </div>

          {/* Exposure Load Score */}
          <div className={`rounded-2xl p-3 border shadow-xs text-center transition-colors bg-white border-slate-200/80 text-slate-900 dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100`}>
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-medium">누적 부하</span>
            </div>
            <div className={`text-base sm:text-lg font-black text-slate-900 dark:text-white`}>
              {data.today.exposure_load}<span className="text-xs font-semibold text-slate-400">점</span>
            </div>
            <span className={`text-[9px] font-bold block mt-0.5 ${data.today.exposure_load <= 40 ? 'text-emerald-500' : 'text-amber-500'
              }`}>
              {data.today.exposure_load <= 40 ? '안전 관리 구간' : '주의 관리 구간'}
            </span>
          </div>

          {/* UV Minutes / Defense */}
          <div className={`rounded-2xl p-3 border shadow-xs text-center transition-colors bg-white border-slate-200/80 text-slate-900 dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100`}>
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Sun className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium">UV 노출</span>
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-500">
              {data.today.uv_minutes}<span className="text-xs font-semibold text-emerald-600">분</span>
            </div>
            <span className="text-[9px] text-emerald-500 font-bold block mt-0.5">
              이동 {data.today.trip_count}회 완료
            </span>
          </div>
        </div>

        {/* Weekly Bar Chart */}
        <div className={`rounded-2xl p-4 border shadow-xs transition-colors bg-white border-slate-200/80 text-slate-900 dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-white`}>
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>요일별 노출 부하 추이</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                적정 관리
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                주의 구간
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="flex items-end justify-between gap-2 h-36 pt-4 px-1">
            {weeklyChartData.map((item, idx) => {
              const heightPercent = maxScore > 0 ? Math.min(100, Math.max(12, Math.round((item.score / maxScore) * 100))) : 12;
              const isHigh = item.score >= 50;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className={`text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 dark:text-slate-300`}>
                    {item.score}점
                  </span>
                  <div className={`w-full max-w-[28px] rounded-t-lg relative flex items-end justify-center h-24 overflow-hidden bg-slate-100 dark:bg-slate-800`}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPercent}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut', delay: idx * 0.05 }}
                      className={`w-full rounded-t-lg transition-colors ${item.isToday
                        ? 'bg-emerald-500'
                        : isHigh
                          ? 'bg-amber-400'
                          : 'bg-emerald-400 hover:bg-emerald-500 dark:bg-emerald-600'
                        }`}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-semibold ${item.isToday
                      ? 'text-emerald-700 bg-emerald-50 px-1 rounded dark:text-emerald-400 dark:bg-emerald-950/60'
                      : 'text-slate-400'
                      }`}
                  >
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Wellness Insight Card */}
        {data.coaching && (
          <div className={`rounded-2xl p-4 border transition-colors bg-slate-50 border-slate-200/80 text-slate-600 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300`}>
            <div className={`flex items-center gap-1.5 text-xs font-bold mb-1.5 text-slate-800 dark:text-slate-200`}>
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>이번 주 이동 건강 코칭</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {data.coaching}
            </p>
          </div>
        )}

        {/* Guest Retention Banner (is_guest === true) */}
        {data.is_guest && (
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold leading-tight">
                  현재 임시 게스트 모드로 기록 중입니다
                </h3>
                <p className="text-[11px] text-amber-100 mt-1 leading-relaxed">
                  카카오 계정을 연동하면 소중한 주간 노출 부하 및 이동 분석 기록이 안전하게 저장돼요.
                </p>
                <button
                  id="btn-report-kakao-save"
                  onClick={startKakaoLogin}
                  style={{ backgroundColor: '#FEE500', color: '#191919' }}
                  className="mt-3 w-full py-2.5 px-3 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 hover:brightness-95 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>카카오로 3초 만에 기록 저장하기</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigate to History Full List */}
        <button
          onClick={() => nav('/history')}
          className={`w-full p-4 rounded-2xl border shadow-xs flex items-center justify-between transition-colors cursor-pointer text-left bg-white border-slate-200/80 hover:bg-slate-50 text-slate-900 dark:bg-slate-900/90 dark:border-slate-800 dark:hover:bg-slate-800/80 dark:text-white`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-700 dark:bg-slate-800 dark:text-emerald-400`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs sm:text-sm font-bold block">
                이동 기록 전체 보기
              </strong>
              <span className={`text-[10px] block text-slate-500 dark:text-slate-400`}>
                지난 이동 경로 및 노출 부하 상세 목록
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
        </>
        )}
      </motion.div>
    </div>
  );
}
