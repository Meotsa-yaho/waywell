import { useNavigate } from 'react-router-dom'

// SC-07 이동 중 / 환승 대기 (스텁)
export default function Trip() {
  const nav = useNavigate()
  return (
    <div className="page">
      <h1>이동 중</h1>
      <div className="card big-timer">
        <small>다음 차량까지</small>
        <strong>6분</strong>
      </div>
      <button className="card shelter-hint" onClick={() => nav('/trip/shelters')}>
        근처 실내 대기 장소 보기 →
      </button>
      <button className="btn" onClick={() => nav('/report')}>이동 종료</button>
      <p className="muted">SC-07 · GET /api/arrival 폴링 예정</p>
    </div>
  )
}
