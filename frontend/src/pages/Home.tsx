import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Environment } from '../types/api'

// SC-03 홈 / 경로 검색
export default function Home() {
  const nav = useNavigate()
  const [env, setEnv] = useState<Environment | null>(null)
  const [from, setFrom] = useState('현재 위치')
  const [to, setTo] = useState('')

  useEffect(() => {
    // 데모: 동탄역 좌표. 실서비스에선 GPS/검색 좌표.
    api.getEnvironment(37.2011, 127.0983).then(setEnv).catch(() => setEnv(null))
  }, [])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  return (
    <div className="page">
      <h1 className="brand">웨이웰</h1>

      {env ? (
        <section className="card env-card">
          <div className="env-row">
            <span>체감 {env.temperature.feels_like}°</span>
            <span>UV {env.uv.index} · {env.uv.grade}</span>
            <span>미세 {env.air.pm10_grade}</span>
          </div>
          <p className="env-comment">{env.comment}</p>
        </section>
      ) : (
        <section className="card skeleton">환경 데이터 불러오는 중…</section>
      )}

      <section className="card">
        <label className="field">
          <span>출발</span>
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="출발지" />
        </label>
        <button className="swap" onClick={swap} aria-label="출발/도착 교환">⇅</button>
        <label className="field">
          <span>도착</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="도착지" />
        </label>
        <button className="btn primary" onClick={() => nav('/routes')}>
          경로 검색
        </button>
      </section>
    </div>
  )
}
