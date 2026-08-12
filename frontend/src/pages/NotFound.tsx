import { Link } from 'react-router-dom'

// SC-14 에러 / 빈 상태 (공통)
export default function NotFound() {
  return (
    <div className="page center">
      <p className="empty">페이지를 찾지 못했어요</p>
      <Link className="btn primary" to="/">홈으로</Link>
    </div>
  )
}
