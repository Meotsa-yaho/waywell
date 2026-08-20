// 카카오 로그인 인가 코드 흐름 (A-09)
export const kakaoRedirectUri = () => `${location.origin}/auth/kakao/callback`

const STATE_KEY = 'kakao_oauth_state'

export function startKakaoLogin() {
  const key = import.meta.env.VITE_KAKAO_REST_KEY
  if (!key) {
    alert('카카오 로그인 설정(VITE_KAKAO_REST_KEY)이 필요해요.')
    return
  }
  // CSRF 방지용 state: 무작위 값 저장 후 콜백에서 일치 검증
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  const url =
    `https://kauth.kakao.com/oauth/authorize?client_id=${key}` +
    `&redirect_uri=${encodeURIComponent(kakaoRedirectUri())}&response_type=code` +
    `&state=${state}`
  window.location.href = url
}

// 콜백의 state가 우리가 발급한 값과 일치하는지 검증(1회용). 불일치=위조 요청 → false.
export function consumeKakaoState(returned: string | null): boolean {
  const saved = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  return !!saved && !!returned && saved === returned
}
