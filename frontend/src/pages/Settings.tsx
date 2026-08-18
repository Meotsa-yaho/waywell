import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useSession } from '../store/session'
import { PRESET_LABEL } from '../lib/presets'
import { useCanInstall, promptInstall, isIOS, isStandalone } from '../lib/pwaInstall'

// SC-10 설정 — 계정(기존 형식) + 나머지 메뉴 형식
export default function Settings() {
  const nav = useNavigate()
  const preset = useSession((s) => s.preset)
  const token = useSession((s) => s.token)
  const logout = useSession((s) => s.logout)
  const canInstall = useCanInstall()
  const installed = isStandalone()

  const install = () => {
    if (canInstall) return void promptInstall()
    if (isIOS()) return void alert('공유 버튼(􀈂) → "홈 화면에 추가"를 누르면 설치돼요.')
    alert('브라우저 주소창의 설치 아이콘(⊕) 또는 메뉴 → "앱 설치"로 추가할 수 있어요.')
  }

  const withdraw = () => {
    if (!confirm('회원 탈퇴 시 계정과 모든 이동 기록이 삭제됩니다. 진행할까요?')) return
    api.deleteMe().catch(() => {}).finally(() => {
      logout()
      nav('/settings', { replace: true })
    })
  }

  return (
    <div className="page settings-page">
      <h1>설정</h1>

      {/* 계정 — 기존 형식 */}
      <section className="card">
        <h2>계정</h2>
        {token ? (
          <button className="btn" onClick={logout}>로그아웃</button>
        ) : (
          <div className="row">
            <Link className="btn primary" to="/login">로그인</Link>
            <Link className="btn" to="/signup">회원가입</Link>
          </div>
        )}
      </section>

      {/* 나머지 — 메뉴 형식 */}
      <div className="menu-list">
        <Link className="menu-item" to="/settings/preset">
          <div className="menu-text">
            <strong>프리셋</strong>
            <span className="muted">{PRESET_LABEL[preset]}</span>
          </div>
          <span className="menu-chevron">›</span>
        </Link>

        <button className="menu-item" onClick={() => nav('/onboarding')}>
          <div className="menu-text">
            <strong>온보딩 다시보기</strong>
            <span className="muted">서비스 소개·프리셋 다시 설정</span>
          </div>
          <span className="menu-chevron">›</span>
        </button>

        <Link className="menu-item" to="/settings/info">
          <div className="menu-text">
            <strong>정보</strong>
            <span className="muted">출처·약관·개인정보·개발자</span>
          </div>
          <span className="menu-chevron">›</span>
        </Link>

        {!installed && (
          <button className="menu-item" onClick={install}>
            <div className="menu-text">
              <strong>홈 화면에 추가</strong>
              <span className="muted">앱처럼 빠르게 실행</span>
            </div>
            <span className="menu-chevron">›</span>
          </button>
        )}
      </div>

      <p className="version">웨이웰 v0.1.0</p>

      {token && (
        <button className="btn withdraw-btn" onClick={withdraw}>회원 탈퇴</button>
      )}
    </div>
  )
}
