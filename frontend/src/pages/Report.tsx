import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import type { WeeklyReport } from '../types/api'

// SC-09 주간 리포트 (핵심 화면)
export default function Report() {
  const nav = useNavigate()
  const [data, setData] = useState<WeeklyReport | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.getWeeklyReport().then(setData).catch(() => setFailed(true))
  }, [])

  if (failed)
    return (
      <div className="page">
        <EmptyState icon="📡" title="리포트를 불러오지 못했어요" hint="네트워크 상태를 확인해주세요."
          actionLabel="다시 시도" onAction={() => location.reload()} />
      </div>
    )

  if (!data) return <div className="page"><div className="card skeleton">리포트 불러오는 중…</div></div>

  if (!data.has_data)
    return (
      <div className="page">
        <EmptyState icon="🚶" title="아직 이동 기록이 없어요" hint="첫 이동을 기록하면 주간 노출 추이가 여기에 쌓여요."
          actionLabel="경로 찾기" onAction={() => nav('/')} />
      </div>
    )

  const chartData = data.daily.map((d) => ({ day: d.date.slice(5), 부하: d.exposure_load }))

  // D-03 전주 대비: 노출 지표는 감소(-)가 좋음 → 초록, 증가(+)는 빨강
  const cmp = data.comparison
  const deltas = [
    { label: '노출 부하', pct: cmp.exposure_load_change_pct },
    { label: '야외 분', pct: cmp.outdoor_minutes_change_pct },
    { label: 'UV 분', pct: cmp.uv_minutes_change_pct },
  ]
  const hasCmp = deltas.some((d) => d.pct !== null)

  return (
    <div className="page">
      <h1>주간 리포트</h1>

      <section className="card today">
        <h2>오늘</h2>
        <div className="today-grid">
          <div><strong>{data.today.outdoor_minutes}</strong><small>야외 분</small></div>
          <div><strong>{data.today.exposure_load}</strong><small>노출 부하</small></div>
          <div><strong>{data.today.uv_minutes}</strong><small>UV 분</small></div>
        </div>
      </section>

      <section className="card">
        <h2>주간 추이</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: 'rgba(26,127,107,0.08)' }} />
            <Bar dataKey="부하" fill="#1a7f6b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {data.coaching && (
          <p className="coaching">{data.coaching}</p>
        )}
      </section>

      {hasCmp && (
        <section className="card">
          <h2>지난주 대비</h2>
          <div className="cmp-grid">
            {deltas.map((d) => (
              <div key={d.label} className="cmp-item">
                <small>{d.label}</small>
                {d.pct === null ? (
                  <strong className="cmp-flat">–</strong>
                ) : (
                  <strong className={d.pct <= 0 ? 'cmp-down' : 'cmp-up'}>
                    {d.pct <= 0 ? '▼' : '▲'} {Math.abs(d.pct)}%
                  </strong>
                )}
              </div>
            ))}
          </div>
          <p className="muted cmp-note">노출 지표는 낮을수록 좋아요 (▼ 감소 = 개선)</p>
        </section>
      )}

      <button className="menu-item" onClick={() => nav('/history')}>
        <div className="menu-text">
          <strong>이동 기록 전체 보기</strong>
          <span className="muted">지난 이동 목록·노출 부하</span>
        </div>
        <span className="menu-chevron">›</span>
      </button>

      {data.is_guest && (
        <section className="card banner">
          가입하면 지금까지의 기록이 계정에 저장돼요
        </section>
      )}
    </div>
  )
}
