import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants'

export default function DashboardProgressCard({ stats, hasStartedLearning }) {
  return (
    <article className="card dashboard-progress-card">
      <h2>Прогресс обучения</h2>
      <div className="dashboard-stats-row">
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.progressPct}%</span>
          <span className="dashboard-stat-label">общий прогресс</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.completed}</span>
          <span className="dashboard-stat-label">модулей пройдено</span>
        </div>
        <div className="dashboard-stat">
          <span className="dashboard-stat-value">{stats.inProgress}</span>
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
    </article>
  )
}
