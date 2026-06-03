import { Link } from 'react-router-dom'
import { ROUTES, PROGRESS_LABELS, PROGRESS_STATUS } from '../../../constants'
import PageState from '../../../components/PageState'

export default function AccountAnalyticsSection({
  loading,
  error,
  hasStartedLearning,
  courseProgressList,
  totalModules,
  progressPct,
  completed,
  inProgress,
  totalAttempts,
  learningHours,
}) {
  return (
    <section className="account-section account-courses-section">
      <article className="card account-summary-card">
        <h2 className="account-section-title">Статистика</h2>
        <div className="account-stats">
          <div className="stat-card stat-card-done">
            <span className="stat-value">{completed}</span>
            <span className="stat-label">Модулей пройдено</span>
          </div>
          <div className="stat-card stat-card-progress">
            <span className="stat-value">{inProgress}</span>
            <span className="stat-label">В процессе</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{totalAttempts}</span>
            <span className="stat-label">Попыток (лабы)</span>
          </div>
          <div className="stat-card stat-card-hours">
            <span className="stat-value">{learningHours}</span>
            <span className="stat-label">Часов обучения</span>
          </div>
        </div>
        {totalModules > 0 && (
          <div className="account-progress-bar-wrap">
            <div className="account-progress-bar-label">
              <span>Общий прогресс</span>
              <span>{progressPct}%</span>
            </div>
            <div className="account-progress-bar">
              <div className="account-progress-bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </article>

      <div className="account-section-block">
        <h2 className="account-section-title">Прогресс по курсам</h2>
      </div>
      {loading && (
        <PageState
          type="empty"
          title="Загрузка прогресса"
          description="Подгружаем ваш прогресс по курсам."
        />
      )}
      {error && (
        <PageState
          type="error"
          title="Не удалось загрузить прогресс"
          description={error.message}
          actionLabel="К курсам"
          actionTo={ROUTES.COURSES}
        />
      )}
      {!loading && !error && !hasStartedLearning ? (
        <div className="account-empty-state card">
          <p className="muted">Прогресс по курсам появится после старта первого курса.</p>
          <Link to={ROUTES.COURSES} className="btn btn-primary page-state-action">
            Начать курс
          </Link>
        </div>
      ) : null}
      {!loading && !error && hasStartedLearning && courseProgressList.length === 0 ? (
        <div className="account-empty-state card">
          <p className="muted">Пройдите модули в курсах — здесь появится прогресс.</p>
          <Link to={ROUTES.COURSES} className="btn btn-primary page-state-action">
            Перейти к курсам
          </Link>
        </div>
      ) : null}
      {!loading && !error && courseProgressList.length > 0 && (
        <div className="account-courses-grid">
          {courseProgressList.map((c) => {
            const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0
            const isComplete = c.completed === c.total
            return (
              <div key={c.courseId} className="account-course-card card">
                <div className="account-course-card-header">
                  <h3 className="account-course-title">{c.courseTitle}</h3>
                  <span className="account-course-count">
                    {c.completed} из {c.total} модулей
                  </span>
                </div>
                <div className="account-progress-bar-wrap account-course-progress">
                  <div className="account-progress-bar">
                    <div
                      className={`account-progress-bar-fill ${isComplete ? 'complete' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <ul className="account-course-modules">
                  {c.modules.map((m, idx) => {
                    // Модуль заблокирован, пока не пройден предыдущий (та же логика, что и в дереве курса).
                    const isLocked =
                      idx > 0 && c.modules[idx - 1]?.progress !== PROGRESS_STATUS.COMPLETED
                    return (
                      <li key={m.id} className="account-course-module-row">
                        <span
                          className={`progress-badge progress-badge-sm ${
                            m.progress === PROGRESS_STATUS.COMPLETED
                              ? 'completed'
                              : m.progress === PROGRESS_STATUS.IN_PROGRESS
                                ? 'in_progress'
                                : ''
                          }`}
                        >
                          {PROGRESS_LABELS[m.progress] ?? m.progress}
                        </span>
                        <span className="account-course-module-title">{m.title}</span>
                        {isLocked ? (
                          <span className="btn btn-sm btn-ghost is-disabled" aria-disabled="true" title="Сначала пройдите предыдущий модуль">
                            Заблокировано
                          </span>
                        ) : (
                          <Link
                            to={ROUTES.COURSE_MODULE(c.courseId, m.id)}
                            className="btn btn-sm btn-ghost"
                          >
                            {m.progress === PROGRESS_STATUS.IN_PROGRESS ? 'Продолжить' : 'Открыть'}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <Link to={ROUTES.COURSE(c.courseId)} className="btn btn-primary btn-sm account-course-link">
                  К курсу
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
