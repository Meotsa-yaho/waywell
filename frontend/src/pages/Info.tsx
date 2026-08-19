import { useNavigate } from 'react-router-dom'

const SOURCES = [
  { icon: '☀️', name: '기상청', desc: '날씨 · 자외선 지수' },
  { icon: '😷', name: '한국환경공단 에어코리아', desc: '미세먼지' },
  { icon: '🧭', name: 'SK Tmap', desc: '대중교통 · 보행자 경로' },
  { icon: '🚇', name: 'ODsay', desc: '대중교통 경로 (보조)' },
  { icon: '🚌', name: '국토교통부 TAGO', desc: '실시간 버스 도착' },
  { icon: '🗺️', name: '카카오', desc: '지도 · 장소 검색' },
]

// 정보 — 데이터 출처 / 이용약관 / 개인정보처리방침 / 개발자
export default function Info() {
  const nav = useNavigate()
  return (
    <div className="page info-page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>

      <div className="info-hero">
        <span className="brand">웨이웰</span>
        <p className="muted">노출 부하를 줄이는 웰니스 내비게이션</p>
      </div>

      <section className="card">
        <h2>📡 데이터 출처</h2>
        <div className="source-list">
          {SOURCES.map((s) => (
            <div key={s.name} className="source-row">
              <span className="source-icon">{s.icon}</span>
              <div className="source-text">
                <strong>{s.name}</strong>
                <span className="muted">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>📄 이용약관</h2>
        <p className="info-body">
          웨이웰은 대중교통 경로의 환경 노출(자외선·미세먼지·더위)을 <b>참고용</b>으로 제공합니다.
          실제 이동 판단의 책임은 이용자에게 있으며, 외부 API 데이터의 정확성·가용성은 보장되지 않습니다.
        </p>
      </section>

      <section className="card">
        <h2>🔒 개인정보처리방침</h2>
        <p className="info-body">
          게스트는 기기 식별자만 사용합니다. 회원은 이메일 또는 카카오 계정과 이동 기록을 저장하며,
          <b> 회원 탈퇴 시 계정과 기록은 즉시 삭제</b>됩니다. 수집한 정보는 제3자에게 제공하지 않습니다.
        </p>
      </section>

      <section className="card dev-card">
        <h2>👩‍💻 만든 사람</h2>
        <p className="dev-team">멋쟁이사자처럼 · <strong>멋사 야호</strong> 팀</p>
        <span className="dev-ver">waywell v0.1.0</span>
      </section>
    </div>
  )
}
