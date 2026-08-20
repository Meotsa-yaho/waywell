import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Shield } from 'lucide-react';

const DISMISS_KEY = 'geo_consent_dismissed';

// A-03 위치정보 사전 동의 — 네이티브 권한창 전에 이유를 설명하고 사용자가 허용할 때 요청.
// 이미 허용된 상태면 조용히 위치 사용(onAllow), 거부면 아무것도 안 함.
export function LocationConsent({ onAllow }: { onAllow: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((st) => {
        if (st.state === 'granted') onAllow();
        else if (st.state === 'prompt') setShow(true);
      })
      .catch(() => setShow(true)); // Permissions API 미지원 → 카드로 안전하게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allow = () => {
    setShow(false);
    onAllow();
  };
  const later = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-xs"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            className={`w-full max-w-xs rounded-2xl border p-5 shadow-2xl bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100`}
          >
            <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-3">
              <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold mb-1">현재 위치를 사용할까요?</h3>
            <p className={`text-xs leading-relaxed mb-2 text-slate-600 dark:text-slate-300`}>
              현재 위치의 날씨·미세먼지와 출발지를 자동으로 맞춰드려요.
            </p>
            <div className={`flex items-start gap-1.5 text-[11px] mb-4 text-slate-500 dark:text-slate-400`}>
              <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
              <span>위치는 기기에서만 쓰이고 서버에 저장하지 않아요.</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={later}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`}
              >
                나중에
              </button>
              <button
                onClick={allow}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
              >
                위치 허용
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export default LocationConsent;
