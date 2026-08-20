import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Clock, Sun, Zap, ArrowRight, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import EmptyState from '../components/EmptyState';
import type { TripSummary } from '../types/api';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

// SC-13 이동 기록 목록 & 삭제 — GET/DELETE /api/trips
export default function History() {
  const nav = useNavigate();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dark Mode State

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };


  useEffect(() => {
    api.listTrips().then(setTrips).catch(() => setFailed(true));
  }, []);

  // Single Trip Deletion
  const handleDeleteTrip = async (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDeletingId(tripId);
      await api.deleteTrip(tripId);
      setTrips((prev) => (prev ? prev.filter((t) => t.id !== tripId) : []));
      showToast('이동 기록이 삭제되었습니다.');
    } catch {
      showToast('이동 기록 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // Clear All Trips
  const handleClearAllTrips = async () => {
    if (!trips || trips.length === 0) return;
    if (!window.confirm('모든 이동 기록을 삭제하시겠습니까?')) return;

    try {
      await api.clearAllTrips();
      setTrips([]);
      showToast('모든 이동 기록이 삭제되었습니다.');
    } catch {
      showToast('기록 삭제 중 오류가 발생했습니다.');
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

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav(-1)}
            className={`p-1.5 -ml-1.5 rounded-full active:scale-95 transition-all cursor-pointer hover:bg-slate-200 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-300`}
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white`}>
              이동 기록 전체 보기
            </h1>
            {trips && trips.length > 0 && (
              <p className={`text-[11px] text-slate-500 dark:text-slate-400`}>
                총 {trips.length}개의 기록
              </p>
            )}
          </div>
        </div>

        {/* Clear All Button */}
        {trips && trips.length > 0 && (
          <button
            type="button"
            onClick={handleClearAllTrips}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition-all cursor-pointer border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/50`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>전체 삭제</span>
          </button>
        )}
      </div>

      {failed && (
        <EmptyState
          icon="📡"
          title="기록을 불러오지 못했어요"
          hint="네트워크 상태를 확인해주세요."
          actionLabel="다시 시도"
          onAction={() => location.reload()}
        />
      )}

      {!failed && !trips && (
        <div className={`p-8 text-center text-xs text-slate-500 dark:text-slate-400`}>
          기록 불러오는 중...
        </div>
      )}

      {!failed && trips && trips.length === 0 && (
        <EmptyState
          icon="🚶"
          title="아직 이동 기록이 없어요"
          hint="첫 이동을 기록하면 여기에 쌓여요."
          actionLabel="경로 찾기"
          onAction={() => nav('/')}
        />
      )}

      {trips && trips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <AnimatePresence>
            {trips.map((t) => {
              const isDeleting = deletingId === t.id;

              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`p-4 rounded-2xl border shadow-xs transition-colors space-y-2.5 relative group bg-white border-slate-200/80 text-slate-900 dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {/* Route Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold truncate min-w-0 flex-1">
                      <span className="truncate">{t.from_name || '출발지'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{t.to_name || '도착지'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTrip(t.id, e)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800`}
                        title="기록 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Date & Stats */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className={`text-[11px] text-slate-500 dark:text-slate-400`}>
                      {fmtDate(t.started_at)}
                    </span>
                    <div className="flex items-center gap-2.5 text-[11px] font-semibold">
                      <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        {t.total_minutes}분
                      </span>
                      <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                        <Sun className="w-3 h-3 text-amber-500" />
                        야외 {t.outdoor_minutes}분
                      </span>
                      <span className={`flex items-center gap-0.5 font-bold ${
                        t.exposure_load <= 40 ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        <Zap className="w-3 h-3" />
                        부하 {t.exposure_load}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
