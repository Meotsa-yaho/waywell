import { Link } from 'react-router-dom'
import { useSession } from '../store/session'
import type { Preset } from '../types/api'

const presets: { id: Preset; label: string }[] = [
  { id: 'normal', label: '일반' },
  { id: 'skin', label: '민감성 피부' },
  { id: 'respiratory', label: '호흡기 주의' },
]

// SC-10 설정
export default function Settings() {
  const preset = useSession((s) => s.preset)
  const setPreset = useSession((s) => s.setPreset)
  const token = useSession((s) => s.token)
  const logout = useSession((s) => s.logout)

  // 실 API 연동 시 PATCH /api/me 도 함께 호출한다.
  const change = (p: Preset) => setPreset(p)

  return (
    <div className="page">
      <h1>설정</h1>

      <section className="card">
        <h2>프리셋</h2>
        <div className="seg">
          {presets.map((p) => (
            <button key={p.id} className={preset === p.id ? 'on' : ''} onClick={() => change(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '12px' }}>
          <Link to="/onboarding" className="link" style={{ fontSize: '13px' }}>
            ✨ 온보딩 맞춤 설정 다시하기
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>계정</h2>
        {token ? (
          <button className="btn" onClick={logout}>로그아웃</button>
        ) : (
          <div className="row">
            <Link className="btn primary" to="/signup">회원가입</Link>
            <Link className="btn" to="/login">로그인</Link>
          </div>
        )}
      </section>

      <p className="version">웨이웰 v0.1.0</p>
    </div>
  )
}
