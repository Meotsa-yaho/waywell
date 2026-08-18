// E-07 빈/에러 상태 공통 표시 (아이콘 + 제목 + 안내 + 선택 액션)
type Props = {
  icon?: string
  title: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ icon = '🗺️', title, hint, actionLabel, onAction }: Props) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{icon}</span>
      <p className="empty-state__title">{title}</p>
      {hint && <p className="empty-state__hint">{hint}</p>}
      {actionLabel && onAction && (
        <button className="btn primary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  )
}
