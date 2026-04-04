export default function DashboardActivityCard({ hasStartedLearning, completedModules, nextModules }) {
  return (
    <article className="card dashboard-activity-card">
      <h2>Последняя активность</h2>
      {!hasStartedLearning ? (
        <p className="muted">Активность появится после старта первого курса.</p>
      ) : completedModules.length === 0 && nextModules.length === 0 ? (
        <p className="muted">Пока нет активности — начни первый модуль.</p>
      ) : (
        <ul className="dashboard-activity-list">
          {completedModules.map((m) => (
            <li key={`done-${m.id}`}>
              <span className="progress-badge completed">Пройден</span>
              <span>{m.title}</span>
            </li>
          ))}
          {nextModules.map((m) => (
            <li key={`next-${m.id}`}>
              <span className={`progress-badge ${m.progress === 'in_progress' ? 'in_progress' : ''}`}>
                {m.progress === 'in_progress' ? 'В процессе' : 'Следующий'}
              </span>
              <span>{m.title}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
