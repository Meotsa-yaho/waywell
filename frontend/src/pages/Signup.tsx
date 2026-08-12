import { Link, useNavigate } from 'react-router-dom'

// SC-12 회원가입 (스텁)
export default function Signup() {
  const nav = useNavigate()
  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>회원가입</h1>
      <p className="muted">가입하면 지금까지의 기록이 계정에 저장돼요</p>
      <input className="search" placeholder="이메일" type="email" />
      <input className="search" placeholder="비밀번호 (8자 이상, 영문+숫자)" type="password" />
      <button className="btn primary">가입하기</button>
      <p className="muted">이미 계정이 있나요? <Link to="/login">로그인</Link></p>
    </div>
  )
}
