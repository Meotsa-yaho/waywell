// 카카오맵 JS SDK 로더 — 한 번만 로드, Promise로 kakao 네임스페이스 반환.
// 키는 도메인 제한이라 프론트 노출 OK (VITE_KAKAO_JS_KEY).
let loading: Promise<any> | null = null

export function loadKakao(): Promise<any> {
  if (loading) return loading
  const key = import.meta.env.VITE_KAKAO_JS_KEY
  loading = new Promise((resolve, reject) => {
    const w = window as any
    if (w.kakao?.maps) {
      w.kakao.maps.load(() => resolve(w.kakao))
      return
    }
    const s = document.createElement('script')
    s.async = true
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`
    s.onload = () => w.kakao.maps.load(() => resolve(w.kakao))
    s.onerror = () => reject(new Error('카카오맵 SDK 로드 실패 (도메인 등록 확인)'))
    document.head.appendChild(s)
  })
  return loading
}
