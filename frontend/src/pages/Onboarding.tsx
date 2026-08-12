import { useNavigate } from 'react-router-dom'
import { useSession } from '../store/session'
import type { Preset } from '../types/api'

const presets: { id: Preset; title: string; desc: string }[] = [
  { id: 'normal', title: '일반', desc: '기본 노출 부하 기준' },
  { id: 'skin', title: '민감성 피부', desc: '자외선 가중' },
  { id: 'respiratory', title: '호흡기 주의', desc: '미세먼지 가중' },
]

// SC-02 온보딩 — 가입 없이 프리셋만 고르고 시작 (게스트)
export default function Onboarding() {
  const nav = useNavigate()
  const setPreset = useSession((s) => s.setPreset)
  const current = useSession((s) => s.preset)
  const complete = useSession((s) => s.completeOnboarding)

  const pick = (p: Preset) => {
    setPreset(p)
    complete()
    nav('/', { replace: true })
  }

  return (
    <div className="page onboarding">
      <h1>어떤 편이세요?</h1>
      <p className="sub">나중에 설정에서 바꿀 수 있어요.</p>
      <div className="preset-list">
        {presets.map((p) => (
          <button
            key={p.id}
            className={'card preset' + (current === p.id ? ' preset--on' : '')}
            onClick={() => pick(p.id)}
          >
            <strong>{p.title}</strong>
            <small>{p.desc}</small>
          </button>
        ))}
      </div>
      <button className="link" onClick={() => pick('normal')}>건너뛰기 (일반)</button>
    </div>
  )
}
