import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KakaoMap from "../components/KakaoMap";
import { api } from "../api/client";
import { useRouteQuery } from "../store/route";
import type { Environment } from "../types/api";

const DEFAULT = { lat: 37.2011, lng: 127.0983 }; // 동탄역

// SC-03 홈 — 지도 우선 + 오늘의 환경 + 경로 검색 진입
export default function Home() {
  const nav = useNavigate();
  const [center, setCenter] = useState(DEFAULT);
  const [located, setLocated] = useState(false); // 실제 위치 확보 여부 (마커는 이때만)
  const [geoDenied, setGeoDenied] = useState(false); // 위치 권한 거부/불가
  const [env, setEnv] = useState<Environment | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const from = useRouteQuery((s) => s.from);
  const to = useRouteQuery((s) => s.to);
  const setPlace = useRouteQuery((s) => s.setPlace);

  const goToCurrentLocation = () => {
    if (!navigator.geolocation) return setGeoDenied(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCenter(loc);
        setLocated(true);
        setGeoDenied(false);
        setRecenterKey((k) => k + 1);
        // 출발지 미설정이거나 '현위치'였으면 현위치로 자동 설정/갱신 (사용자가 고른 장소는 유지)
        const cur = useRouteQuery.getState().from;
        if (!cur || cur.place_id === "current") {
          setPlace("from", {
            place_id: "current",
            name: "현재 위치",
            address: "",
            category: "",
            ...loc,
          });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoDenied(true);
      },
      { timeout: 6000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    goToCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 현위치 버튼: 현위치로 지도 이동 (확대 없이)
  const locate = () => goToCurrentLocation();

  useEffect(() => {
    api
      .getEnvironment(center.lat, center.lng)
      .then(setEnv)
      .catch(() => setEnv(null));
  }, [center.lat, center.lng]);

  return (
    <div className="home-map">
      <div className="map-fill">
        <KakaoMap
          center={center}
          markers={located ? [{ lat: center.lat, lng: center.lng }] : []}
          recenterKey={recenterKey}
        />
      </div>

      <button
        className="locate-btn"
        onClick={locate}
        aria-label="현위치로 이동"
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <line x1="12" y1="1" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="23" />
          <line x1="1" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="23" y2="12" />
        </svg>
      </button>

      <div className="map-overlay">
        {env && (
          <div className="env-chip">
            체감 {env.temperature?.feels_like ?? "-"}° · UV{" "}
            {env.uv?.index ?? "-"} · 미세먼지 {env.air?.pm10_grade ?? "-"}
          </div>
        )}
        {geoDenied && (
          <div className="geo-hint">
            📍 위치 권한이 꺼져 있어요. 출발지를 검색해 설정하세요.
          </div>
        )}
        <div className="search-card">
          <button
            className={"search-field" + (from ? "" : " muted-field")}
            onClick={() => nav("/search?target=from")}
          >
            🟢 {from ? from.name : geoDenied ? "출발지 입력" : "현재 위치"}
          </button>
          <button
            className={"search-field" + (to ? "" : " muted-field")}
            onClick={() => nav("/search?target=to")}
          >
            🔴 {to ? to.name : "도착지 입력"}
          </button>
          <button
            className="btn primary"
            disabled={!to}
            onClick={() => nav("/routes")}
          >
            경로 검색
          </button>
        </div>
      </div>
    </div>
  );
}
