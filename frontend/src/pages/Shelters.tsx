import { useNavigate } from 'react-router-dom'

// SC-08 실내 대기 장소 (바텀시트 스텁)
export default function Shelters() {
  const nav = useNavigate()
  return (
    <div className="page sheet">
      <button className="link" onClick={() => nav(-1)}>닫기</button>
      <h1>실내 대기 장소</h1>
      <p className="muted">SC-08 · GET /api/shelters 연동 예정</p>
    </div>
  )
}
