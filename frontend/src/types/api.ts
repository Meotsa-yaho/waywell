// API 명세서 v0.1 과 1:1. 확정 시 함께 갱신한다.

export type Preset = 'normal' | 'skin' | 'respiratory'
export type PredictionGrade = 'precise' | 'realtime' | 'estimated'
export type DataSource = 'gbis' | 'seoul' | 'tago' | 'timetable'

export interface ApiError {
  error: { code: string; message: string; detail: string | null }
}

// --- 인증 / 프로필 ---
export interface Me {
  id: string
  type: 'user' | 'guest'
  email: string | null
  preset: Preset
  created_at: string
}

export interface AuthResponse {
  access_token: string
  user: { id: string; email: string; preset: Preset }
  migration?: { migrated: boolean; trip_count: number }
}

// --- 장소 검색 (SC-04) ---
export interface Place {
  place_id: string
  name: string
  address: string
  category: string
  lat: number
  lng: number
  distance_m?: number
}

// --- 환경 (SC-03) ---
export interface Environment {
  observed_at: string
  uv: { index: number; grade: string }
  temperature: { current: number; feels_like: number; humidity: number }
  air: { pm10: number; pm10_grade: string; pm25: number; pm25_grade: string }
  precipitation: { type: 'none' | 'rain' | 'rain_snow' | 'snow' | 'shower'; probability: number }
  comment: string
  partial: boolean
}

// --- 경로 (SC-05 / SC-06) ---
export type SegmentType =
  | 'walk'
  | 'bus_wait'
  | 'bus'
  | 'subway_wait'
  | 'subway'
  | 'transfer_walk'

export interface RouteSegment {
  seq: number
  type: SegmentType
  minutes: number
  outdoor: boolean
  exposure_minutes: number
  line?: string
  route_name?: string
  station?: string
  station_id?: string
  route_id?: string
  from?: { name: string; lat?: number; lng?: number }
  to?: { name: string; lat?: number; lng?: number }
  note?: string
}

export interface Route {
  route_id: string
  rank: number
  recommended: boolean
  exposure_load: number
  exposure_breakdown: { uv: number; heat: number; air: number }
  outdoor_minutes: number
  indoor_ratio: number
  total_minutes: number
  arrival_time: string
  transfers: number
  prediction_grade: PredictionGrade
  data_source: DataSource
  notice: string | null
  llm_comment: string | null
  segments: RouteSegment[]
}

export interface RoutesResponse {
  query: {
    from: { lat: number; lng: number; name: string }
    to: { lat: number; lng: number; name: string }
    depart_at: string
    preset: Preset
  }
  environment: { uv: number; feels_like: number; pm10_grade: string; precipitation: string }
  routes: Route[]
}

export interface ExplainResponse {
  comments: Record<string, string>
  generated_by: 'llm' | 'template'
}

// --- 이동 중 (SC-07 / SC-08) ---
export interface Arrival {
  station_id: string
  route_id: string
  route_name: string
  arrivals: { seq: number; minutes: number; raw_minutes: number | null; corrected: boolean; vehicle_id?: string | null }[]
  prediction_grade: PredictionGrade
  data_source: DataSource
  notice: string | null
  polled_at: string
}

export interface Shelter {
  place_id: string
  name: string
  category: 'cafe' | 'convenience' | 'mart' | 'subway_station' | 'other'
  address: string
  lat: number
  lng: number
  distance_m: number
  walk_minutes: number
  map_url: string
}

export interface Trip {
  trip_id: string
  status: 'in_progress' | 'completed' | 'cancelled'
}

// --- 리포트 (SC-09) ---
export interface DailyReport {
  date: string
  outdoor_minutes: number
  exposure_load: number
  uv_minutes: number
  trip_count: number
}

export interface WeeklyReport {
  period: { start: string; end: string }
  today: DailyReport
  daily: DailyReport[]
  comparison: {
    previous_period: { start: string; end: string }
    uv_minutes_change_pct: number | null
    outdoor_minutes_change_pct: number | null
    exposure_load_change_pct: number | null
  }
  coaching: string
  is_guest: boolean
  has_data: boolean
}
