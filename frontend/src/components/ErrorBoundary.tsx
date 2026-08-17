import { Component, type ReactNode } from 'react'

// E-07 렌더 크래시 방어 — 화이트스크린 대신 복구 화면
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="empty-state" style={{ height: '100dvh' }}>
        <span className="empty-state__icon">😵</span>
        <p className="empty-state__title">화면을 불러오지 못했어요</p>
        <p className="empty-state__hint">잠시 후 다시 시도해주세요.</p>
        <button className="btn primary" onClick={() => location.reload()}>새로고침</button>
      </div>
    )
  }
}
