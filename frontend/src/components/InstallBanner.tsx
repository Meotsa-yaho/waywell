import { useState } from 'react'
import { useCanInstall, promptInstall, isIOS, isStandalone } from '../lib/pwaInstall'

// E-03 홈 화면 추가 배너
// Android/Chrome: beforeinstallprompt(전역 캡처) → 네이티브 설치. iOS Safari: 공유 메뉴 안내.
const DISMISS_KEY = 'install_banner_dismissed'

export default function InstallBanner() {
  const canInstall = useCanInstall()
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY))

  if (dismissed || isStandalone()) return null
  const iosHint = isIOS()
  if (!canInstall && !iosHint) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  const install = async () => {
    await promptInstall()
    dismiss()
  }

  return (
    <div className="install-banner">
      <span className="install-banner__icon">📲</span>
      <div className="install-banner__text">
        <strong>웨이웰을 홈 화면에 추가</strong>
        <span>{iosHint ? '공유 → "홈 화면에 추가"를 눌러 앱처럼 사용하세요' : '앱처럼 빠르게 실행할 수 있어요'}</span>
      </div>
      {canInstall && <button className="btn primary install-banner__cta" onClick={install}>추가</button>}
      <button className="install-banner__close" onClick={dismiss} aria-label="닫기">✕</button>
    </div>
  )
}
