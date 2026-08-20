import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '../store/session';
import { useRouteQuery } from '../store/route';
import { HomeSearchTab } from '../components/main/HomeSearchTab';
import { RouteCandidatesView } from '../components/main/RouteCandidatesView';
import { LocationConsent } from '../components/LocationConsent';
import { loadKakao } from '../lib/kakao';

const DEFAULT = { lat: 37.2011, lng: 127.0983 }; // 동탄역

// SC-03 / SC-05 홈 — 홈 검색 탭 & 카카오 지도 기반 경로 후보 탐색 뷰
export default function Home() {
  const preset = useSession((s) => s.preset);
  const fromPlace = useRouteQuery((s) => s.from);
  const toPlace = useRouteQuery((s) => s.to);
  const setPlace = useRouteQuery((s) => s.setPlace);
  const addRecent = useRouteQuery((s) => s.addRecent);
  const isDemoActive = useRouteQuery((s) => s.isDemoActive);
  const exitDemoSession = useRouteQuery((s) => s.exitDemoSession);

  const [center, setCenter] = useState(DEFAULT);
  const [locationName, setLocationName] = useState('서울시 강남구');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchRouteState, setSearchRouteState] = useState<{
    origin: string;
    destination: string;
  } | null>(() => {
    if (isDemoActive) {
      return {
        origin: fromPlace?.name || '동탄역',
        destination: toPlace?.name || '강남역',
      };
    }
    return null;
  });

  // 데모 모드 진입 감지
  useEffect(() => {
    if (isDemoActive) {
      setSearchRouteState({
        origin: fromPlace?.name || '동탄역',
        destination: toPlace?.name || '강남역',
      });
    }
  }, [isDemoActive, fromPlace?.name, toPlace?.name]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // GPS 현재 위치 + 카카오 역지오코딩. LocationConsent가 허용 시(또는 이미 허용됨) 호출.
  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCenter(loc);
        loadKakao()
          .then((kakao: any) => {
            new kakao.maps.services.Geocoder().coord2Address(loc.lng, loc.lat, (res: any[], status: string) => {
              if (status === kakao.maps.services.Status.OK && res[0]) {
                const addr = res[0].road_address?.address_name || res[0].address?.address_name || '현재 위치';
                setLocationName(addr);
                if (!fromPlace) {
                  setPlace('from', { place_id: 'current', name: addr, address: addr, category: '', ...loc });
                }
              }
            });
          })
          .catch(() => {});
      },
      () => {},
      { timeout: 5000, maximumAge: 60000 }
    );
  };

  const handleRequestRouteCandidates = (originName: string, destName: string) => {
    if (!destName || !destName.trim()) {
      showToast('도착지를 설정해주세요.');
      return;
    }
    setSearchRouteState({ origin: originName, destination: destName });
    addRecent({
      place_id: `place_${Date.now()}`,
      name: destName,
      address: destName,
      category: '목적지',
      lat: toPlace?.lat ?? 37.4979,
      lng: toPlace?.lng ?? 127.0276,
    });
    showToast(`'${destName}' 신체 부하 최소 경로를 분석합니다.`);
  };

  const handleBackToSearch = () => {
    if (isDemoActive) {
      exitDemoSession();
    }
    setSearchRouteState(null);
  };

  return (
    <div className={`min-h-full font-sans transition-colors duration-200 ${
      searchRouteState ? 'pb-0 overflow-hidden' : 'pb-20 p-4 sm:p-5'
    } bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100`}>
      {/* A-03 위치정보 사전 동의 */}
      <LocationConsent onAllow={requestLocation} />

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

      <AnimatePresence mode="wait">
        {searchRouteState ? (
          <RouteCandidatesView
            key="route-candidates"
            originName={searchRouteState.origin}
            destinationName={searchRouteState.destination}
            onBackToSearch={handleBackToSearch}
            onShowToast={showToast}
          />
        ) : (
          <HomeSearchTab
            key="home-search"
            userPreset={preset}
            locationName={locationName}
            lat={center.lat}
            lng={center.lng}
            onRequestRouteCandidates={handleRequestRouteCandidates}
            onShowToast={showToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
