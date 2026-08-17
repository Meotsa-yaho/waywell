import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useSession } from '../store/session'
import { startKakaoLogin } from '../lib/kakaoAuth'

// SC-12 회원가입 (이메일 + 카카오)
export default function Signup() {
  const nav = useNavigate()
  const setToken = useSession((s) => s.setToken)
  const preset = useSession((s) => s.preset)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = () => {
    setBusy(true)
    setError(null)
    api
      .signup(email, password, preset)
      .then((res) => {
        setToken(res.access_token)
        nav('/', { replace: true })
      })
      .catch((e) => setError(e?.response?.status === 409 ? '이미 가입된 이메일이에요.' : '이메일과 6자 이상 비밀번호가 필요해요.'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>회원가입</h1>
      <p className="muted">가입하면 지금까지의 기록이 계정에 저장돼요</p>

      <input className="search" placeholder="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <input className="search" placeholder="비밀번호 (6자 이상)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="empty" style={{ padding: 0 }}>{error}</p>}
      <button className="btn primary" disabled={busy || !email || !password} onClick={submit}>{busy ? '가입 중…' : '가입하기'}</button>

      <button className="btn kakao" onClick={startKakaoLogin}>카카오로 시작하기</button>

      <p className="muted">이미 계정이 있나요? <Link to="/login">로그인</Link></p>
    </div>
  )
}
