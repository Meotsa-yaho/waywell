import axios from 'axios'
import type {
  Environment,
  RoutesResponse,
  WeeklyReport,
  Me,
  Place,
  Shelter,
  Arrival,
  Trip,
} from '../types/api'

// VITE_USE_MOCK=true 면 /mock/*.json 을 읽고, 아니면 실 API(/api/*)를 부른다.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const http = axios.create({ baseURL: '/api', timeout: 10000 })

// 게스트/로그인 신원 헤더 부착 (API 명세서 1장)
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  const deviceId = localStorage.getItem('device_id')
  if (token) config.headers.Authorization = `Bearer ${token}`
  else if (deviceId) config.headers['X-Device-Id'] = deviceId
  return config
})

async function mock<T>(name: string): Promise<T> {
  const res = await fetch(`/mock/${name}.json`)
  if (!res.ok) throw new Error(`mock ${name} 없음`)
  return res.json()
}

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
  getMe: () =>
    USE_MOCK ? mock<Me>('me') : http.get<Me>('/me').then((r) => r.data),

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

  startTrip: (body: unknown) =>
    USE_MOCK
      ? Promise.resolve<Trip>({ trip_id: 't_mock', status: 'in_progress' })
      : http.post<Trip>('/trips', body).then((r) => r.data),

  getWeeklyReport: (week_of?: string) =>
    USE_MOCK
      ? mock<WeeklyReport>('report.weekly')
      : http.get<WeeklyReport>('/report/weekly', { params: { week_of } }).then((r) => r.data),
}
