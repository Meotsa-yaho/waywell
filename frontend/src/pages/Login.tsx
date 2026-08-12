import { Link, useNavigate } from 'react-router-dom'

// SC-11 로그인 (스텁)
export default function Login() {
  const nav = useNavigate()
  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>로그인</h1>
      <input className="search" placeholder="이메일" type="email" />
      <input className="search" placeholder="비밀번호" type="password" />
      <button className="btn primary">로그인</button>
      <p className="muted">계정이 없나요? <Link to="/signup">회원가입</Link></p>
    </div>
  )
}
