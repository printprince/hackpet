import { PROGRESS_LABELS, PROGRESS_STATUS } from '../../../constants'

export default function CourseModulePanel({ module, onStartModule }) {
  const isCompleted = module.progress === PROGRESS_STATUS.COMPLETED
  const attemptCount = module.attempt_count ?? 0
  const attemptedNotPassed = !isCompleted && attemptCount > 0

  const statusLabel = isCompleted
    ? PROGRESS_LABELS[PROGRESS_STATUS.COMPLETED]
    : attemptedNotPassed
      ? 'Не пройден'
      : (PROGRESS_LABELS[module.progress] ?? module.progress)

  const badgeClass = isCompleted
    ? 'completed'
    : attemptedNotPassed
      ? 'not-passed'
      : module.progress === PROGRESS_STATUS.IN_PROGRESS
        ? 'in_progress'
        : ''

  const buttonLabel = attemptedNotPassed
    ? 'Попробовать снова'
    : module.progress === PROGRESS_STATUS.IN_PROGRESS && module.last_step
      ? 'Продолжить'
      : 'Пройти'

  return (
    <div className="course-module-panel card">
      <strong className="block">{module.title}</strong>
      <p className="meta course-module-meta">
        {module.topic}
      </p>
      {module.summary ? <p className="course-module-summary">{module.summary}</p> : null}
      <span className={`progress-badge ${badgeClass}`}>
        {statusLabel}
      </span>
      <div className="card-actions">
        {!isCompleted && (
          <button type="button" className="btn btn-primary" onClick={onStartModule}>
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  )
}
