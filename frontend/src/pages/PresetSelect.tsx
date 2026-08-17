import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { SENSITIVITY_OPTIONS } from '../data/onboardingOptions'
import { SENSITIVITY_TO_PRESET, PRESET_TO_SENSITIVITY } from '../lib/presets'
import { useSession } from '../store/session'
import { api } from '../api/client'
import type { SensitivityId } from '../types/onboarding'

// 프리셋 선택 — 온보딩 민감도 카드 재사용 (설명 포함) + 저장
export default function PresetSelect() {
  const nav = useNavigate()
  const preset = useSession((s) => s.preset)
  const setPreset = useSession((s) => s.setPreset)
  const token = useSession((s) => s.token)
  const [selected, setSelected] = useState<SensitivityId>(PRESET_TO_SENSITIVITY[preset])

  const save = () => {
    const p = SENSITIVITY_TO_PRESET[selected]
    setPreset(p)
    if (token) api.patchMe(p).catch(() => {}) // 로그인 상태면 계정에도 저장
    nav(-1)
  }

  return (
    <div className="page">
      <button className="link" onClick={() => nav(-1)}>← 뒤로</button>
      <h1>프리셋</h1>
      <p className="muted">가장 피하고 싶은 상황을 골라주세요. 경로 가중치가 맞춰집니다.</p>

      <div className="space-y-2.5">
        {SENSITIVITY_OPTIONS.map((o) => {
          const isSel = selected === o.id
          return (
            <div
              key={o.id}
              onClick={() => setSelected(o.id)}
              className={`p-3.5 rounded-2xl cursor-pointer transition-all ${
                isSel ? 'border-2 border-emerald-500 bg-emerald-50' : 'border border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-base shrink-0">
                  {o.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className={`text-sm font-bold ${isSel ? 'text-emerald-950' : 'text-slate-800'}`}>
                      {o.category}
                    </h2>
                    {isSel && <Check className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{o.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button className="btn primary sticky" onClick={save}>저장</button>
    </div>
  )
}
