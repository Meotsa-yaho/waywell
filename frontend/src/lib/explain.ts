import { api } from '../api/client'
import type { Route, RoutesResponse } from '../types/api'

/**
 * B-09 — 경로 목록에 LLM 코멘트(llm_comment)를 채워 넣는다.
 *
 * 경로 응답과 분리해 나중에 붙이는 이유: 카드는 즉시 보여주고 문구만 뒤늦게 채우기 위함.
 * 실패하면 원본 경로를 그대로 돌려준다 — 문구는 부가 정보라 화면을 막으면 안 된다.
 */
export async function withLlmComments(res: RoutesResponse): Promise<Route[]> {
  try {
    const { comments } = await api.explainRoutes({
      preset: res.query.preset,
      environment: res.environment,
      routes: res.routes.map((r) => ({
        route_id: r.route_id,
        recommended: r.recommended,
        total_minutes: r.total_minutes,
        outdoor_minutes: r.outdoor_minutes,
        exposure_load: r.exposure_load,
        exposure_breakdown: r.exposure_breakdown,
        transfers: r.transfers,
        // 문구 생성에 쓰는 값만 (좌표·소요 상세는 제외)
        segments: r.segments.map((s) => ({
          type: s.type,
          minutes: s.minutes,
          line: s.line,
          route_name: s.route_name,
          station: s.station,
        })),
      })),
    })
    return res.routes.map((r) => (comments[r.route_id] ? { ...r, llm_comment: comments[r.route_id] } : r))
  } catch {
    return res.routes
  }
}
