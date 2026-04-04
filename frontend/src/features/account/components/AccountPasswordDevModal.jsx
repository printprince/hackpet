export default function AccountPasswordDevModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="dev-modal-overlay" role="presentation" onClick={onClose}>
      <div className="dev-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="dev-modal-close"
          aria-label="Закрыть модалку"
          onClick={onClose}
        >
          ×
        </button>
        <h2>Смена пароля в разработке</h2>
        <p className="muted">
          Функция смены пароля будет добавлена в ближайших обновлениях. Пока можно менять никнейм, email и аватар.
        </p>
        <div className="dev-modal-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}
