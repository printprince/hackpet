import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants'

export default function DashboardProgressCard({ stats, hasStartedLearning, recommendedCourses = [] }) {
  const completed = Number(stats?.completed) || 0
  const inProgress = Number(stats?.inProgress) || 0
  const progressPct = Number(stats?.progressPct) || 0

  return (
    <article className="card dashboard-progress-card">
      <h2>Прогресс обучения</h2>
      <div className="dashboard-stats-row">
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{progressPct}%</span>
          <span className="dashboard-stat-label">общий прогресс</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{completed}</span>
          <span className="dashboard-stat-label">модулей пройдено</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{inProgress}</span>
          <span className="dashboard-stat-label">в процессе</span>
        </div>
      </div>
      <div className="dashboard-actions">
        <Link to={ROUTES.COURSES} className="btn btn-primary">
          {hasStartedLearning ? 'Продолжить обучение' : 'Начать курс'}
        </Link>
        <Link to={ROUTES.ACCOUNT} className="btn btn-secondary">
          Личный кабинет
        </Link>
      </div>
      <div className="dashboard-recommended-courses">
        <h3>Рекомендуемые курсы</h3>
        {recommendedCourses.length === 0 ? (
          <p className="muted">Скоро покажем персональные рекомендации.</p>
        ) : (
          <ul className="dashboard-recommended-list">
            {recommendedCourses.map((course) => (
              <li key={course.id}>
                <Link to={ROUTES.COURSE(course.id)}>{course.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}
