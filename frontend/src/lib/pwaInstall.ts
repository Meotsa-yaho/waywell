import { useSyncExternalStore } from 'react'

// PWA 설치 프롬프트 전역 캡처 (beforeinstallprompt는 앱 로드 초기에 1회만 발생 → 싱글턴)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  emit()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  emit()
})

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// 네이티브 설치 프롬프트 호출. 성공 여부 반환. (프롬프트 없으면 false)
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const res = await deferred.userChoice
  deferred = null
  emit()
  return res.outcome === 'accepted'
}

// 네이티브 설치 프롬프트를 지금 띄울 수 있는지 (구독형)
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => deferred !== null,
    () => false,
  )
}
