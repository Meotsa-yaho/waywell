import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../store/session'

// SC-01 스플래시 — 세션 확인 후 온보딩/홈으로
export default function Splash() {
  const nav = useNavigate()
  const onboarded = useSession((s) => s.onboarded)

  useEffect(() => {
    const t = setTimeout(() => nav(onboarded ? '/' : '/onboarding', { replace: true }), 900)
    return () => clearTimeout(t)
  }, [nav, onboarded])

  return (
    <div className="splash">
      <h1 className="brand-lg">웨이웰</h1>
      <p>이동 시간을 설계하는 웰니스 내비게이션</p>
    </div>
  )
}
