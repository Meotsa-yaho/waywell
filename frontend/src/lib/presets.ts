import type { Preset } from '../types/api'
import type { SensitivityId } from '../types/onboarding'

// 온보딩 민감도 ↔ 노출엔진 프리셋
export const SENSITIVITY_TO_PRESET: Record<SensitivityId, Preset> = {
  uv: 'skin',
  dust: 'respiratory',
  temp: 'heat',
  balanced: 'normal',
}

export const PRESET_TO_SENSITIVITY: Record<Preset, SensitivityId> = {
  skin: 'uv',
  respiratory: 'dust',
  heat: 'temp',
  normal: 'balanced',
}

export const PRESET_LABEL: Record<Preset, string> = {
  normal: '스마트 밸런스',
  skin: '피부·자외선 민감',
  respiratory: '호흡기 케어',
  heat: '더위·추위 취약',
}
