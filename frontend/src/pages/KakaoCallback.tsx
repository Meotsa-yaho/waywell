import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useSession } from '../store/session'
import { kakaoRedirectUri, startKakaoLogin, consumeKakaoState } from '../lib/kakaoAuth'
import type { Preset } from '../types/api'

// 카카오 인가 코드 콜백 → 백엔드 교환 → JWT 저장 후 홈
export default function KakaoCallback() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const setToken = useSession((s) => s.setToken)
  const setPreset = useSession((s) => s.setPreset)
  const [error, setError] = useState(false)
  const done = useRef(false) // StrictMode 중복 호출 방지 (인가 코드는 1회용)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const code = params.get('code')
    if (!code) return setError(true)
    if (!consumeKakaoState(params.get('state'))) return setError(true) // CSRF: state 불일치 시 거부
    api
      .kakaoLogin(code, kakaoRedirectUri())
      .then((res) => {
        setToken(res.access_token)
        // 온보딩에서 카카오로 왔으면 그때 고른 프리셋을 계정에 반영, 아니면 계정 프리셋 로드
        const ob = localStorage.getItem('onboarding_preset')
        if (ob) {
          localStorage.removeItem('onboarding_preset')
          setPreset(ob as Preset)
          api.patchMe(ob).catch(() => {})
        } else {
          setPreset(res.user.preset)
        }
        nav('/', { replace: true })
      })
      .catch(() => setError(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page center">
      {error ? (
        <>
          <p className="empty">카카오 로그인에 실패했어요.</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button className="btn" onClick={startKakaoLogin}>다시 시도</button>
            <button className="btn outline" onClick={() => nav('/', { replace: true })}>홈으로 가기</button>
          </div>
        </>
      ) : (
        <div className="card skeleton">카카오 로그인 중…</div>
      )}
    </div>
  )
}
