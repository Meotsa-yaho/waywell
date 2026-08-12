import { useNavigate } from 'react-router-dom'

// SC-04 장소 검색 (스텁)
export default function PlaceSearch() {
  const nav = useNavigate()
  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>장소 검색</h1>
      <input className="search" placeholder="장소를 검색하세요" autoFocus />
      <p className="muted">SC-04 · GET /api/places/search 연동 예정</p>
    </div>
  )
}
