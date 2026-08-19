import axios from 'axios'
import type {
  Environment,
  RoutesResponse,
  WeeklyReport,
  Me,
  AuthResponse,
  Place,
  Shelter,
  Arrival,
  Trip,
  TripSummary,
} from '../types/api'

const http = axios.create({ baseURL: '/api', timeout: 10000 })

// 게스트/로그인 신원 헤더 부착 (API 명세서 1장)
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  const deviceId = localStorage.getItem('device_id')
  if (token) config.headers.Authorization = `Bearer ${token}`
  else if (deviceId) config.headers['X-Device-Id'] = deviceId
  return config
})

export interface RouteParams {
  from: string
  to: string
  from_name?: string
  to_name?: string
  depart_at?: string
  preset?: string
  sort?: 'exposure' | 'duration' | 'recommend'
  demo_weather?: string
  geometry?: string // '1' 이면 실제 선로 좌표 포함 (상세 화면)
}

export const api = {
  getMe: () => http.get<Me>('/me/').then((r) => r.data),

  kakaoLogin: (code: string, redirect_uri: string) =>
    http.post<AuthResponse>('/auth/kakao/', { code, redirect_uri }).then((r) => r.data),

  patchMe: (preset: string) =>
    http.patch<Me>('/me/', { preset }).then((r) => r.data),

  deleteMe: () => http.delete('/me/').then(() => true),

  // 장소 검색은 백엔드(카카오 로컬) 구현 완료 → 목업 모드여도 실 API
  searchPlaces: (q: string, lat?: number, lng?: number) =>
    http.get<{ places: Place[] }>('/places/search', { params: { q, lat, lng } }).then((r) => r.data.places),

  // 환경(날씨)은 백엔드(기상청·에어코리아) 구현 완료 → 목업 모드여도 실 API
  getEnvironment: (lat: number, lng: number) =>
    http.get<Environment>('/environment', { params: { lat, lng } }).then((r) => r.data),

  // 경로는 백엔드 구현 완료 → 목업 모드여도 실 API 호출 (demo_weather 지원)
  getRoutes: (params: RouteParams) =>
    http.get<RoutesResponse>('/routes', { params }).then((r) => r.data),

  // 도착정보는 백엔드(TAGO) 구현 완료 → 목업 모드여도 실 API 호출
  getArrival: (station_id: string, route_id?: string, city_code?: string) =>
    http.get<Arrival>('/arrival', { params: { station_id, route_id, city_code } }).then((r) => r.data),

  // 실내 대기장소는 백엔드(카카오 로컬) 구현 완료 → 목업 모드여도 실 API
  getShelters: (lat: number, lng: number) =>
    http.get<{ shelters: Shelter[] }>('/shelters', { params: { lat, lng } }).then((r) => r.data.shelters),

  // 이동 기록·리포트는 백엔드 구현 완료 → 목업 모드여도 실 API. POST/PATCH는 slash 필수(Django APPEND_SLASH)
  listTrips: () =>
    http.get<{ trips: TripSummary[] }>('/trips/').then((r) => r.data.trips),

  startTrip: (body: unknown) =>
    http.post<Trip>('/trips/', body).then((r) => r.data),

  completeTrip: (trip_id: string) =>
    http.patch<Trip>(`/trips/${trip_id}/`, { status: 'completed' }).then((r) => r.data),

  deleteTrip: (trip_id: string) =>
    http.delete<{ deleted: boolean; trip_id: string }>(`/trips/${trip_id}/`).then((r) => r.data),

  clearAllTrips: () =>
    http.delete<{ deleted: boolean; count: number }>('/trips/').then((r) => r.data),

  getWeeklyReport: (week_of?: string) =>
    http.get<WeeklyReport>('/report/weekly/', { params: { week_of } }).then((r) => r.data),
}
