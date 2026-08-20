import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Database, FileText, Shield, Users, CheckCircle2 } from 'lucide-react';

export type SettingsInfoType = 'sources' | 'terms' | 'privacy' | 'team';

interface SettingsInfoModalProps {
  type: SettingsInfoType | null;
  isOpen: boolean;
  onClose: () => void;
}

const DATA_SOURCES = [
  { name: '기상청', desc: '날씨 · 자외선 지수', badge: '실시간 날씨 API' },
  { name: '한국환경공단 에어코리아', desc: '미세먼지 (PM10 · PM2.5)', badge: '대기환경측정망' },
  { name: 'SK Tmap', desc: '대중교통 · 보행자 경로', badge: 'Tmap API' },
  { name: 'ODsay', desc: '대중교통 경로 (보조)', badge: '통합 대중교통' },
  { name: '국토교통부 TAGO', desc: '실시간 버스 도착', badge: '공공데이터포털' },
  { name: '카카오', desc: '지도 · 장소 검색', badge: 'Kakao Maps API' },
];

export const SettingsInfoModal: React.FC<SettingsInfoModalProps> = ({
  type,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !type) return null;

  const getHeaderInfo = () => {
    switch (type) {
      case 'sources':
        return {
          title: '데이터 출처',
          subtitle: '웨이웰에서 활용하는 공공 및 상용 데이터 연동처',
          icon: <Database className="w-5 h-5 text-emerald-500" />,
        };
      case 'terms':
        return {
          title: '이용약관',
          subtitle: '서비스 이용 시 유의사항 및 책임 고지',
          icon: <FileText className="w-5 h-5 text-teal-500" />,
        };
      case 'privacy':
        return {
          title: '개인정보처리방침',
          subtitle: '이용자 데이터 보호 및 취급 정책',
          icon: <Shield className="w-5 h-5 text-blue-500" />,
        };
      case 'team':
        return {
          title: '만든 사람',
          subtitle: '웨이웰 프로젝트 제작 및 개발팀',
          icon: <Users className="w-5 h-5 text-amber-500" />,
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full max-w-sm rounded-3xl shadow-2xl border p-5 max-h-[85vh] flex flex-col z-10 transition-colors overflow-hidden bg-white border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`}
        >
          {/* Header */}
          <div className={`flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800`}>
                {header.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">
                  {header.title}
                </h3>
                <p className={`text-[11px] text-slate-500 dark:text-slate-400`}>
                  {header.subtitle}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-xl transition-colors cursor-pointer text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto py-3.5 space-y-3 text-xs leading-relaxed">
            {type === 'sources' && (
              <div className="space-y-2.5">
                <div className="space-y-2">
                  {DATA_SOURCES.map((source) => (
                    <div
                      key={source.name}
                      className={`p-3 rounded-2xl border flex items-center justify-between bg-slate-50 border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-700/60`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">
                            {source.name}
                          </span>
                          <span className={`text-[11px] px-1.5 py-0.2 rounded font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300`}>
                            {source.badge}
                          </span>
                        </div>
                        <p className={`text-[11px] mt-0.5 text-slate-600 dark:text-slate-400`}>
                          {source.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className={`text-[11px] text-center pt-1 text-slate-400 dark:text-slate-500`}>
                  각 기관의 오픈 API 및 데이터 파트너십을 통해 정밀하게 수집됩니다.
                </p>
              </div>
            )}

            {type === 'terms' && (
              <div className="space-y-3">
                <div className={`p-4 rounded-2xl border leading-relaxed bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/50 dark:border-slate-700/60 dark:text-slate-300`}>
                  <p className="text-xs font-semibold mb-2 text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    서비스 제공 범위 및 면책 고지
                  </p>
                  <p className="text-xs leading-relaxed">
                    웨이웰은 대중교통 경로의 환경 노출(자외선·미세먼지·더위)을 참고용으로 제공합니다. 실제 이동 판단의 책임은 이용자에게 있으며, 외부 API 데이터의 정확성·가용성은 보장되지 않습니다.
                  </p>
                </div>
                <div className={`text-[11px] p-3 rounded-xl bg-slate-100/70 text-slate-500 dark:bg-slate-800/30 dark:text-slate-400`}>
                  기상 이변, 도로 통제, 대중교통 파업 및 연착 등 현장 상황에 따라 실제 이동 환경과 차이가 발생할 수 있습니다.
                </div>
              </div>
            )}

            {type === 'privacy' && (
              <div className="space-y-3">
                <div className={`p-4 rounded-2xl border leading-relaxed bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/50 dark:border-slate-700/60 dark:text-slate-300`}>
                  <p className="text-xs font-semibold mb-2 text-emerald-500 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    개인정보 수집 및 파기 원칙
                  </p>
                  <p className="text-xs leading-relaxed">
                    게스트는 기기 식별자만 사용합니다. 회원은 이메일 또는 카카오 계정과 이동 기록을 저장하며, 회원 탈퇴 시 계정과 기록은 즉시 삭제됩니다. 수집한 정보는 제3자에게 제공하지 않습니다.
                  </p>
                </div>
                <div className={`text-[11px] p-3 rounded-xl bg-slate-100/70 text-slate-500 dark:bg-slate-800/30 dark:text-slate-400`}>
                  웨이웰은 불필요한 위치 로그를 장기 보관하지 않으며, 암호화된 안전한 인프라 내에서 엄격히 관리됩니다.
                </div>
              </div>
            )}

            {type === 'team' && (
              <div className="space-y-3">
                <div className={`p-5 rounded-2xl border text-center bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700/60`}>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2.5">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className={`text-sm font-bold text-slate-900 dark:text-white`}>
                    멋쟁이사자처럼 · 멋사 야호 팀
                  </h4>
                  <p className={`text-[11px] mt-1 text-slate-500 dark:text-slate-400`}>
                    보행자 신체 건강과 쾌적한 출퇴근 경로를 위해 연구하고 개발합니다 🦁
                  </p>
                </div>
                <div className={`text-[11px] text-center text-slate-400 dark:text-slate-500`}>
                  WayWell v0.1.0 · All rights reserved
                </div>
              </div>
            )}
          </div>

          {/* Footer Close Button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className={`w-full py-2.5 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white`}
            >
              닫기
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default SettingsInfoModal;
