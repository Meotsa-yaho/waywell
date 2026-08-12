import { useNavigate } from 'react-router-dom'

// SC-13 이동 기록 목록 (P1, 스텁)
export default function History() {
  const nav = useNavigate()
  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>이동 기록</h1>
      <p className="muted">SC-13 · GET /api/trips 연동 예정 (P1)</p>
    </div>
  )
}
