// 카카오 로그인 인가 코드 흐름 (A-09)
export const kakaoRedirectUri = () => `${location.origin}/auth/kakao/callback`

export function startKakaoLogin() {
  const key = import.meta.env.VITE_KAKAO_REST_KEY
  if (!key) {
    alert('카카오 로그인 설정(VITE_KAKAO_REST_KEY)이 필요해요.')
    return
  }
  const url =
    `https://kauth.kakao.com/oauth/authorize?client_id=${key}` +
    `&redirect_uri=${encodeURIComponent(kakaoRedirectUri())}&response_type=code`
  window.location.href = url
}
