import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useSession } from '../store/session'
import { startKakaoLogin } from '../lib/kakaoAuth'

// SC-11 로그인 (이메일 + 카카오)
export default function Login() {
  const nav = useNavigate()
  const setToken = useSession((s) => s.setToken)
  const setPreset = useSession((s) => s.setPreset)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = () => {
    setBusy(true)
    setError(null)
    api
      .login(email, password)
      .then((res) => {
        setToken(res.access_token)
        setPreset(res.user.preset)
        nav('/', { replace: true })
      })
      .catch(() => setError('이메일 또는 비밀번호가 올바르지 않아요.'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>로그인</h1>

      <input className="search" placeholder="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <input className="search" placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="empty" style={{ padding: 0 }}>{error}</p>}
      <button className="btn primary" disabled={busy || !email || !password} onClick={submit}>{busy ? '로그인 중…' : '로그인'}</button>

      <button className="btn kakao" onClick={startKakaoLogin}>카카오로 로그인</button>

      <p className="muted">계정이 없나요? <Link to="/signup">회원가입</Link></p>
    </div>
  )
}
